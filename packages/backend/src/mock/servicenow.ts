// Mock ServiceNow HRSD API

export interface HrsdCase {
  id: string;
  number: string;
  subject: string;
  description: string;
  category: string;
  priority: "1" | "2" | "3" | "4";
  state: "new" | "in_progress" | "resolved" | "closed";
  assignedTo?: string;
  openedAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

const cases: HrsdCase[] = [];
let caseCounter = 1000;

export function createHrsdCase(params: {
  subject: string;
  description: string;
  category: string;
  priority?: "1" | "2" | "3" | "4";
  reportedBy?: string;
}): { success: boolean; case?: HrsdCase; error?: string } {
  const hrCase: HrsdCase = {
    id: `case-${++caseCounter}`,
    number: `HRSD${caseCounter}`,
    subject: params.subject,
    description: params.description,
    category: params.category,
    priority: params.priority ?? "3",
    state: "new",
    openedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  cases.push(hrCase);
  return { success: true, case: hrCase };
}

export function getHrsdCaseStatus(caseId: string): HrsdCase | null {
  return cases.find((c) => c.id === caseId || c.number === caseId) ?? null;
}

export function getAllCases(): HrsdCase[] {
  return [...cases].sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
  );
}
