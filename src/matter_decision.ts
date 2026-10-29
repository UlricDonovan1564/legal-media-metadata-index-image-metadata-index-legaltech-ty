export type FollowUpState = "scheduled" | "due_soon" | "overdue";

export function decideFollowUp(deadline: string, now: Date): FollowUpState {
  const deadlineAt = new Date(deadline);
  const remainingMs = deadlineAt.getTime() - now.getTime();

  if (remainingMs < 0) return "overdue";
  if (remainingMs <= 72 * 60 * 60 * 1000) return "due_soon";
  return "scheduled";
}
