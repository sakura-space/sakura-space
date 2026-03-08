import Anthropic from "@anthropic-ai/sdk";
import * as mock from "../../mock/smarthr";

export const smarthrTools: Anthropic.Tool[] = [
  {
    name: "smarthr_get_employee_info",
    description:
      "SmartHRから従業員情報を取得します。従業員ID（emp-xxx形式）またはメールアドレスで検索できます。",
    input_schema: {
      type: "object" as const,
      properties: {
        employee_id: {
          type: "string",
          description: "従業員ID（例: emp-001）",
        },
        email: {
          type: "string",
          description: "従業員のメールアドレス（employee_idの代わりに使用可）",
        },
      },
    },
  },
  {
    name: "smarthr_get_leave_balance",
    description:
      "SmartHRから従業員の有給残日数を取得します。",
    input_schema: {
      type: "object" as const,
      properties: {
        employee_id: {
          type: "string",
          description: "従業員ID（例: emp-001）",
        },
      },
      required: ["employee_id"],
    },
  },
  {
    name: "smarthr_submit_leave_request",
    description:
      "SmartHRに有給休暇申請を提出します。申請前に必ず有給残日数を確認してください。",
    input_schema: {
      type: "object" as const,
      properties: {
        employee_id: {
          type: "string",
          description: "従業員ID",
        },
        type: {
          type: "string",
          enum: ["annual", "sick", "special"],
          description: "休暇種別: annual=有給, sick=病気休暇, special=特別休暇",
        },
        start_date: {
          type: "string",
          description: "開始日（YYYY-MM-DD形式）",
        },
        end_date: {
          type: "string",
          description: "終了日（YYYY-MM-DD形式）",
        },
        days: {
          type: "number",
          description: "日数",
        },
        reason: {
          type: "string",
          description: "申請理由",
        },
      },
      required: ["employee_id", "type", "start_date", "end_date", "days", "reason"],
    },
  },
  {
    name: "smarthr_submit_attendance_correction",
    description:
      "SmartHRに打刻修正を申請します。",
    input_schema: {
      type: "object" as const,
      properties: {
        employee_id: {
          type: "string",
          description: "従業員ID",
        },
        date: {
          type: "string",
          description: "対象日（YYYY-MM-DD形式）",
        },
        original_clock_in: {
          type: "string",
          description: "元の出勤時刻（HH:MM形式）",
        },
        corrected_clock_in: {
          type: "string",
          description: "修正後の出勤時刻（HH:MM形式）",
        },
        original_clock_out: {
          type: "string",
          description: "元の退勤時刻（HH:MM形式）",
        },
        corrected_clock_out: {
          type: "string",
          description: "修正後の退勤時刻（HH:MM形式）",
        },
        reason: {
          type: "string",
          description: "修正理由",
        },
      },
      required: [
        "employee_id",
        "date",
        "original_clock_in",
        "corrected_clock_in",
        "original_clock_out",
        "corrected_clock_out",
        "reason",
      ],
    },
  },
];

export function executeSmarthrTool(
  name: string,
  input: Record<string, unknown>
): unknown {
  switch (name) {
    case "smarthr_get_employee_info": {
      const employeeId = input.employee_id as string | undefined;
      const email = input.email as string | undefined;
      if (employeeId) {
        const emp = mock.getEmployeeInfo(employeeId);
        return emp ?? { error: "従業員が見つかりません" };
      } else if (email) {
        const emp = mock.getEmployeeByEmail(email);
        return emp ?? { error: "従業員が見つかりません" };
      }
      return { error: "employee_id または email を指定してください" };
    }
    case "smarthr_get_leave_balance": {
      const bal = mock.getLeaveBalance(input.employee_id as string);
      return bal ?? { error: "従業員が見つかりません" };
    }
    case "smarthr_submit_leave_request": {
      return mock.submitLeaveRequest({
        employeeId: input.employee_id as string,
        type: input.type as string,
        startDate: input.start_date as string,
        endDate: input.end_date as string,
        days: input.days as number,
        reason: input.reason as string,
      });
    }
    case "smarthr_submit_attendance_correction": {
      return mock.submitAttendanceCorrection({
        employeeId: input.employee_id as string,
        date: input.date as string,
        originalClockIn: input.original_clock_in as string,
        correctedClockIn: input.corrected_clock_in as string,
        originalClockOut: input.original_clock_out as string,
        correctedClockOut: input.corrected_clock_out as string,
        reason: input.reason as string,
      });
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
