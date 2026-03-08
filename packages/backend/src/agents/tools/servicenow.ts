import Anthropic from "@anthropic-ai/sdk";
import * as mock from "../../mock/servicenow";

export const servicenowTools: Anthropic.Tool[] = [
  {
    name: "servicenow_create_hrsd_case",
    description:
      "ServiceNowにHRSDケースを作成します。エージェントで解決できない複雑な問題や、承認が必要な案件に使用します。",
    input_schema: {
      type: "object" as const,
      properties: {
        subject: {
          type: "string",
          description: "ケースの件名",
        },
        description: {
          type: "string",
          description: "問題の詳細説明",
        },
        category: {
          type: "string",
          enum: ["leave", "attendance", "payroll", "benefits", "general"],
          description:
            "カテゴリ: leave=休暇, attendance=勤怠, payroll=給与, benefits=福利厚生, general=一般",
        },
        priority: {
          type: "string",
          enum: ["1", "2", "3", "4"],
          description: "優先度: 1=緊急, 2=高, 3=中, 4=低",
        },
      },
      required: ["subject", "description", "category"],
    },
  },
  {
    name: "servicenow_get_hrsd_case_status",
    description:
      "ServiceNowのHRSDケースの状態を確認します。",
    input_schema: {
      type: "object" as const,
      properties: {
        case_id: {
          type: "string",
          description: "ケースID（case-xxxまたはHRSDxxx形式）",
        },
      },
      required: ["case_id"],
    },
  },
];

export function executeServiceNowTool(
  name: string,
  input: Record<string, unknown>
): unknown {
  switch (name) {
    case "servicenow_create_hrsd_case": {
      return mock.createHrsdCase({
        subject: input.subject as string,
        description: input.description as string,
        category: input.category as string,
        priority: input.priority as "1" | "2" | "3" | "4" | undefined,
      });
    }
    case "servicenow_get_hrsd_case_status": {
      const c = mock.getHrsdCaseStatus(input.case_id as string);
      return c ?? { error: "ケースが見つかりません" };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
