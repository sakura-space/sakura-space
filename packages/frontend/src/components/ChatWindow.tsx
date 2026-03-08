import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { AuthUser } from "../stores/auth";

export interface ChatMessage {
  id: string;
  senderName: string;
  content: string;
  type: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  user?: { id: string; name: string; role: string };
}

export interface AgentEvent {
  type: "thinking" | "stream" | "tool_call" | "tool_result" | "done" | "error" | "escalated";
  text?: string;
  tool?: string;
  input?: unknown;
  result?: unknown;
  error?: string;
  reason?: string;
}

interface Props {
  roomId: string;
  socket: Socket;
  currentUser: AuthUser;
  initialMessages: ChatMessage[];
}

export default function ChatWindow({ roomId, socket, currentUser, initialMessages }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [agentState, setAgentState] = useState<"idle" | "thinking" | "streaming">("idle");
  const [streamBuffer, setStreamBuffer] = useState("");
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.emit("room:join", { roomId });

    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.type === "AGENT_TEXT") {
        setStreamBuffer("");
        setAgentState("idle");
      }
    };
    const onAgentStart = () => {
      setAgentState("thinking");
      setStreamBuffer("");
      setAgentEvents([]);
    };
    const onAgentStream = ({ text }: { text: string }) => {
      setAgentState("streaming");
      setStreamBuffer((prev) => prev + text);
    };
    const onAgentDone = () => {
      setAgentState("idle");
      setStreamBuffer("");
    };
    const onAgentToolCall = (data: { tool: string; input: unknown }) => {
      setAgentEvents((prev) => [...prev, { type: "tool_call", ...data }]);
    };
    const onAgentToolResult = (data: { tool: string; result: unknown }) => {
      setAgentEvents((prev) => [...prev, { type: "tool_result", ...data }]);
    };
    const onAgentEscalated = (data: { reason: string }) => {
      setAgentEvents((prev) => [...prev, { type: "escalated", reason: data.reason }]);
      setAgentState("idle");
    };
    const onAgentError = (data: { error: string }) => {
      setAgentEvents((prev) => [...prev, { type: "error", error: data.error }]);
      setAgentState("idle");
    };
    const onMemberJoined = (data: { user: { name: string; role: string } }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          senderName: "システム",
          content: `👤 ${data.user.name} が参加しました`,
          type: "SYSTEM",
          createdAt: new Date().toISOString(),
        },
      ]);
    };

    socket.on("message:new", onMessage);
    socket.on("agent:start", onAgentStart);
    socket.on("agent:stream", onAgentStream);
    socket.on("agent:done", onAgentDone);
    socket.on("agent:tool_call", onAgentToolCall);
    socket.on("agent:tool_result", onAgentToolResult);
    socket.on("agent:escalated", onAgentEscalated);
    socket.on("agent:error", onAgentError);
    socket.on("room:member_joined", onMemberJoined);

    return () => {
      socket.emit("room:leave", { roomId });
      socket.off("message:new", onMessage);
      socket.off("agent:start", onAgentStart);
      socket.off("agent:stream", onAgentStream);
      socket.off("agent:done", onAgentDone);
      socket.off("agent:tool_call", onAgentToolCall);
      socket.off("agent:tool_result", onAgentToolResult);
      socket.off("agent:escalated", onAgentEscalated);
      socket.off("agent:error", onAgentError);
      socket.off("room:member_joined", onMemberJoined);
    };
  }, [roomId, socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBuffer, agentEvents]);

  const sendMessage = () => {
    const content = input.trim();
    if (!content) return;
    socket.emit("message:send", { roomId, content });
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} currentUser={currentUser} />
        ))}

        {/* Agent streaming */}
        {(agentState === "thinking" || agentState === "streaming") && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-sakura-100 flex items-center justify-center text-sm flex-shrink-0">
              🌸
            </div>
            <div className="max-w-[75%]">
              <p className="text-xs text-gray-400 mb-1">さくらHRアシスタント</p>
              <div className="bg-sakura-50 border border-sakura-200 rounded-2xl rounded-tl-sm px-4 py-3">
                {agentState === "thinking" && !streamBuffer && (
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-sakura-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-sakura-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-sakura-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
                {streamBuffer && <p className="text-gray-800 whitespace-pre-wrap">{streamBuffer}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Agent events (tool calls) */}
        {agentEvents.map((ev, i) => (
          <AgentEventBubble key={i} event={ev} />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="text-xs text-gray-400 mb-2">
          💡 <code className="bg-gray-100 px-1 rounded">/hr 有給を申請したい</code> などでHRエージェントを呼び出せます
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="メッセージを入力..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sakura-400"
            disabled={agentState !== "idle"}
          />
          <button
            onClick={sendMessage}
            disabled={agentState !== "idle" || !input.trim()}
            className="btn-primary"
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, currentUser }: { msg: ChatMessage; currentUser: AuthUser }) {
  const isMe = msg.user?.id === currentUser.id;
  const isSystem = msg.type === "SYSTEM";
  const isAgent = msg.type === "AGENT_TEXT";

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  if (isAgent) {
    return (
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-sakura-100 flex items-center justify-center text-sm flex-shrink-0">
          🌸
        </div>
        <div className="max-w-[75%]">
          <p className="text-xs text-gray-400 mb-1">さくらHRアシスタント</p>
          <div className="bg-sakura-50 border border-sakura-200 rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-gray-800 whitespace-pre-wrap">{msg.content}</p>
          </div>
          <p className="text-xs text-gray-300 mt-1">
            {new Date(msg.createdAt).toLocaleTimeString("ja-JP")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          isMe ? "bg-sakura-500 text-white" : "bg-gray-200 text-gray-600"
        }`}
      >
        {msg.senderName.charAt(0)}
      </div>
      <div className={`max-w-[75%] ${isMe ? "items-end" : ""} flex flex-col`}>
        <p className={`text-xs text-gray-400 mb-1 ${isMe ? "text-right" : ""}`}>
          {msg.senderName}
        </p>
        <div
          className={`px-4 py-3 rounded-2xl ${
            isMe
              ? "bg-sakura-500 text-white rounded-tr-sm"
              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
          }`}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
        <p className={`text-xs text-gray-300 mt-1 ${isMe ? "text-right" : ""}`}>
          {new Date(msg.createdAt).toLocaleTimeString("ja-JP")}
        </p>
      </div>
    </div>
  );
}

function AgentEventBubble({ event }: { event: AgentEvent }) {
  if (event.type === "tool_call") {
    return (
      <div className="flex justify-center">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 max-w-sm">
          🔧 <span className="font-mono">{event.tool}</span> を実行中...
        </div>
      </div>
    );
  }
  if (event.type === "escalated") {
    return (
      <div className="flex justify-center">
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 text-sm text-yellow-800 max-w-sm text-center">
          🔔 <strong>オペレータに転送しました</strong>
          <p className="mt-1 text-xs">{event.reason}</p>
        </div>
      </div>
    );
  }
  if (event.type === "error") {
    return (
      <div className="flex justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
          ⚠️ {event.error}
        </div>
      </div>
    );
  }
  return null;
}
