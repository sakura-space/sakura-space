import Anthropic from "@anthropic-ai/sdk";
import { Server } from "socket.io";
import { PrismaClient, Role, ApiType } from "@prisma/client";
import { config } from "../config";
import { getEnabledPermissions } from "../services/permission";
import { smarthrTools, executeSmarthrTool } from "./tools/smarthr";
import { servicenowTools, executeServiceNowTool } from "./tools/servicenow";

const prisma = new PrismaClient();

// ── System Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `あなたは「さくらHRアシスタント」です。従業員のHR関連の問い合わせをサポートする専門AIエージェントです。

## 役割
- 有給申請、打刻修正などの各種HR申請をサポートする
- SmartHRやServiceNowのAPIを使って手続きを代行する
- 解決できない問題は適切にエスカレーションする

## ルール
1. 申請には必ず従業員IDが必要。まず従業員情報を取得して確認すること
2. 有給申請前は必ず残日数を確認すること
3. 自分のツールで解決できない場合は escalate_to_operator ツールを使うこと
4. 日本語で丁寧に回答すること
5. 個人情報は必要最小限のみ参照すること

## エスカレーション基準
- 複数の承認が必要な案件
- システムエラーが発生した場合
- 規定外の特例対応が必要な場合
- ユーザーが人間のサポートを希望する場合`;

// ── Escalation Tool ────────────────────────────────────────────────────────

const escalateTool: Anthropic.Tool = {
  name: "escalate_to_operator",
  description:
    "エージェントで解決できない場合や、人間のオペレータのサポートが必要な場合に使用します。オペレータに通知し、チャットに参加するよう依頼します。",
  input_schema: {
    type: "object" as const,
    properties: {
      reason: {
        type: "string",
        description: "エスカレーションの理由",
      },
      summary: {
        type: "string",
        description: "これまでの対応内容のサマリー",
      },
    },
    required: ["reason", "summary"],
  },
};

// ── Agent History (in-memory + DB) ─────────────────────────────────────────

type ConversationMessage = Anthropic.MessageParam;

async function getHistory(roomId: string): Promise<ConversationMessage[]> {
  const session = await prisma.agentSession.findUnique({ where: { roomId } });
  if (!session) return [];
  return session.history as unknown as ConversationMessage[];
}

async function saveHistory(roomId: string, history: ConversationMessage[]) {
  await prisma.agentSession.upsert({
    where: { roomId },
    update: { history: history as object[], updatedAt: new Date() },
    create: { roomId, history: history as object[] },
  });
}

async function saveMessage(
  roomId: string,
  content: string,
  type: "AGENT_TEXT" | "AGENT_TOOL_CALL" | "AGENT_TOOL_RESULT" | "SYSTEM",
  metadata?: object
) {
  await prisma.message.create({
    data: {
      roomId,
      senderName: "さくらHRアシスタント",
      content,
      type,
      metadata: metadata ?? undefined,
    },
  });
}

// ── Main Agent Runner ──────────────────────────────────────────────────────

export interface AgentRunParams {
  roomId: string;
  userMessage: string;
  userId: string;
  userEmail: string;
  userRole: Role;
  io: Server;
}

export async function runHrAgent(params: AgentRunParams) {
  const { roomId, userMessage, userEmail, userRole, io } = params;

  // Build tool list based on permissions
  const permissions = await getEnabledPermissions(userRole);
  const enabledActions = new Set(permissions.map((p) => `${p.api}:${p.action}`));

  const tools: Anthropic.Tool[] = [escalateTool];

  for (const tool of smarthrTools) {
    const action = tool.name.replace("smarthr_", "");
    if (enabledActions.has(`${ApiType.SMARTHR}:${action}`)) {
      tools.push(tool);
    }
  }
  for (const tool of servicenowTools) {
    const action = tool.name.replace("servicenow_", "");
    if (enabledActions.has(`${ApiType.SERVICENOW}:${action}`)) {
      tools.push(tool);
    }
  }

  // Load conversation history
  const history = await getHistory(roomId);
  history.push({ role: "user", content: userMessage });

  // Emit agent start
  io.to(`room:${roomId}`).emit("agent:start", { roomId });

  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

  // Agentic loop
  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Emit thinking state
    io.to(`room:${roomId}`).emit("agent:thinking", { status: "thinking" });
    io.to("monitor").emit("agent:thinking", { roomId, status: "thinking" });

    let accumulatedText = "";
    let accumulatedThinking = "";

    try {
      const stream = anthropic.messages.stream({
        model: "claude-opus-4-6",
        max_tokens: 4096,
        thinking: { type: "enabled", budget_tokens: 2000 },
        system: `${SYSTEM_PROMPT}\n\nユーザーのメールアドレス: ${userEmail}（従業員情報取得に使用可）`,
        tools,
        messages: history,
      });

      // Stream text and thinking deltas
      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            accumulatedText += event.delta.text;
            io.to(`room:${roomId}`).emit("agent:stream", {
              text: event.delta.text,
            });
          } else if (event.delta.type === "thinking_delta") {
            accumulatedThinking += event.delta.thinking;
            // Thinking visible only to monitor
            io.to("monitor").emit("agent:thinking_stream", {
              roomId,
              text: event.delta.thinking,
            });
          }
        }
      }

      const response = await stream.finalMessage();
      history.push({ role: "assistant", content: response.content });

      // Save final text message to DB
      if (accumulatedText) {
        await saveMessage(roomId, accumulatedText, "AGENT_TEXT", {
          thinking: accumulatedThinking || undefined,
        });
      }

      // End of conversation
      if (response.stop_reason === "end_turn") {
        io.to(`room:${roomId}`).emit("agent:done", { roomId });
        io.to("monitor").emit("agent:done", { roomId });
        break;
      }

      // Handle tool use
      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          const input = toolUse.input as Record<string, unknown>;

          // Emit tool call event
          io.to(`room:${roomId}`).emit("agent:tool_call", {
            tool: toolUse.name,
            input,
          });
          io.to("monitor").emit("agent:tool_call", {
            roomId,
            tool: toolUse.name,
            input,
          });

          await saveMessage(
            roomId,
            `ツール呼び出し: ${toolUse.name}`,
            "AGENT_TOOL_CALL",
            { tool: toolUse.name, input }
          );

          let result: unknown;

          // Handle escalation
          if (toolUse.name === "escalate_to_operator") {
            result = await handleEscalation(roomId, input, io);
          } else if (toolUse.name.startsWith("smarthr_")) {
            result = executeSmarthrTool(toolUse.name, input);
          } else if (toolUse.name.startsWith("servicenow_")) {
            result = executeServiceNowTool(toolUse.name, input);
          } else {
            result = { error: `Unknown tool: ${toolUse.name}` };
          }

          const resultStr = JSON.stringify(result, null, 2);

          // Emit tool result
          io.to(`room:${roomId}`).emit("agent:tool_result", {
            tool: toolUse.name,
            result,
          });
          io.to("monitor").emit("agent:tool_result", {
            roomId,
            tool: toolUse.name,
            result,
          });

          await saveMessage(roomId, resultStr, "AGENT_TOOL_RESULT", {
            tool: toolUse.name,
            result,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: resultStr,
          });
        }

        history.push({ role: "user", content: toolResults });
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "不明なエラーが発生しました";
      console.error("[HrAgent] Error:", err);
      io.to(`room:${roomId}`).emit("agent:error", { error: errorMsg });
      io.to("monitor").emit("agent:error", { roomId, error: errorMsg });
      break;
    }
  }

  await saveHistory(roomId, history);
}

async function handleEscalation(
  roomId: string,
  input: Record<string, unknown>,
  io: Server
) {
  const reason = input.reason as string;
  const summary = input.summary as string;

  // Update agent session status
  await prisma.agentSession.upsert({
    where: { roomId },
    update: { status: "ESCALATED" },
    create: { roomId, status: "ESCALATED", history: [] },
  });

  // Save escalation message
  await prisma.message.create({
    data: {
      roomId,
      senderName: "システム",
      content: `🔔 エスカレーション: ${reason}`,
      type: "SYSTEM",
      metadata: { reason, summary },
    },
  });

  // Notify operators
  io.to("operators").emit("escalation:new", {
    roomId,
    reason,
    summary,
  });

  io.to(`room:${roomId}`).emit("agent:escalated", {
    reason,
    summary,
  });

  return {
    success: true,
    message: "オペレータに通知しました。まもなくサポート担当者が参加します。",
  };
}
