// Mock SmartHR API データ

export interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  hireDate: string;
  email: string;
}

export interface LeaveBalance {
  employeeId: string;
  annual: number;
  used: number;
  remaining: number;
  carryOver: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface AttendanceCorrection {
  id: string;
  employeeId: string;
  date: string;
  originalClockIn: string;
  correctedClockIn: string;
  originalClockOut: string;
  correctedClockOut: string;
  reason: string;
  status: "pending" | "approved";
  createdAt: string;
}

// In-memory mock data
const employees: Employee[] = [
  {
    id: "emp-001",
    name: "田中 三郎",
    department: "営業部",
    position: "主任",
    hireDate: "2020-04-01",
    email: "user1@sakura.co",
  },
  {
    id: "emp-002",
    name: "鈴木 四郎",
    department: "開発部",
    position: "エンジニア",
    hireDate: "2021-07-01",
    email: "user2@sakura.co",
  },
];

const leaveBalances: Record<string, LeaveBalance> = {
  "emp-001": {
    employeeId: "emp-001",
    annual: 20,
    used: 8,
    remaining: 12,
    carryOver: 5,
  },
  "emp-002": {
    employeeId: "emp-002",
    annual: 15,
    used: 3,
    remaining: 12,
    carryOver: 2,
  },
};

const leaveRequests: LeaveRequest[] = [];
const attendanceCorrections: AttendanceCorrection[] = [];
let leaveRequestIdCounter = 100;
let correctionIdCounter = 200;

// SmartHR mock API functions

export function getEmployeeInfo(employeeId: string): Employee | null {
  return employees.find((e) => e.id === employeeId) ?? null;
}

export function getEmployeeByEmail(email: string): Employee | null {
  return employees.find((e) => e.email === email) ?? null;
}

export function getLeaveBalance(employeeId: string): LeaveBalance | null {
  return leaveBalances[employeeId] ?? null;
}

export function submitLeaveRequest(params: {
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
}): { success: boolean; request?: LeaveRequest; error?: string } {
  const balance = leaveBalances[params.employeeId];
  if (!balance) {
    return { success: false, error: "従業員が見つかりません" };
  }
  if (params.type === "annual" && balance.remaining < params.days) {
    return {
      success: false,
      error: `有給残日数が不足しています（残: ${balance.remaining}日、申請: ${params.days}日）`,
    };
  }

  const request: LeaveRequest = {
    id: `leave-${++leaveRequestIdCounter}`,
    employeeId: params.employeeId,
    type: params.type,
    startDate: params.startDate,
    endDate: params.endDate,
    days: params.days,
    reason: params.reason,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  leaveRequests.push(request);

  // Update balance (mock approval)
  if (params.type === "annual") {
    balance.used += params.days;
    balance.remaining -= params.days;
  }

  return { success: true, request };
}

export function submitAttendanceCorrection(params: {
  employeeId: string;
  date: string;
  originalClockIn: string;
  correctedClockIn: string;
  originalClockOut: string;
  correctedClockOut: string;
  reason: string;
}): { success: boolean; correction?: AttendanceCorrection; error?: string } {
  const correction: AttendanceCorrection = {
    id: `corr-${++correctionIdCounter}`,
    ...params,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  attendanceCorrections.push(correction);
  return { success: true, correction };
}
