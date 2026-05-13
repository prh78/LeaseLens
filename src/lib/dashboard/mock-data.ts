export type LeaseRisk = "low" | "medium" | "high" | "critical";

export type LeaseStatus = "active" | "renewal" | "notice" | "closed";

export type MockLease = Readonly<{
  id: string;
  propertyName: string;
  nextAction: string;
  daysRemaining: number;
  riskLevel: LeaseRisk;
  status: LeaseStatus;
}>;

export type MockAlert = Readonly<{
  id: string;
  title: string;
  dueLabel: string;
  severity: "info" | "warning" | "critical";
}>;

export const dashboardMetrics = {
  totalLeases: 124,
  criticalActionsDue: 8,
  highRiskLeases: 5,
} as const;

export const mockLeases: MockLease[] = [
  {
    id: "1",
    propertyName: "Harbour View Apartments",
    nextAction: "Rent review response",
    daysRemaining: 12,
    riskLevel: "high",
    status: "active",
  },
  {
    id: "2",
    propertyName: "Northside Retail Park",
    nextAction: "Break notice acknowledgment",
    daysRemaining: 4,
    riskLevel: "critical",
    status: "notice",
  },
  {
    id: "3",
    propertyName: "Citygate Office Tower — Level 14",
    nextAction: "Insurance certificate renewal",
    daysRemaining: 28,
    riskLevel: "low",
    status: "active",
  },
  {
    id: "4",
    propertyName: "Riverside Logistics Unit B",
    nextAction: "Schedule dilapidations survey",
    daysRemaining: 45,
    riskLevel: "medium",
    status: "renewal",
  },
  {
    id: "5",
    propertyName: "Elm Street Medical Centre",
    nextAction: "Tenant fit-out sign-off",
    daysRemaining: 7,
    riskLevel: "high",
    status: "active",
  },
  {
    id: "6",
    propertyName: "Southbank Studios (Block C)",
    nextAction: "Service charge reconciliation",
    daysRemaining: 21,
    riskLevel: "medium",
    status: "active",
  },
];

export const mockAlerts: MockAlert[] = [
  {
    id: "a1",
    title: "Break option window opens — Northside Retail Park",
    dueLabel: "In 2 days",
    severity: "critical",
  },
  {
    id: "a2",
    title: "Rent review counter-notice deadline",
    dueLabel: "Mar 18",
    severity: "warning",
  },
  {
    id: "a3",
    title: "Schedule statutory compliance inspection",
    dueLabel: "Within 14 days",
    severity: "info",
  },
  {
    id: "a4",
    title: "High-risk portfolio review — quarterly",
    dueLabel: "Mar 22",
    severity: "warning",
  },
];
