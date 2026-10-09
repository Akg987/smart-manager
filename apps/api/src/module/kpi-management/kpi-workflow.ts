export type ReviewableCheckin = {
  status: string;
  userId: bigint;
};

export function canReviewCheckin(checkin: ReviewableCheckin, actorId: bigint) {
  return (
    (checkin.status === "submitted" ||
      checkin.status === "data_submitted" ||
      checkin.status === "revised") &&
    checkin.userId !== actorId
  );
}

export function canCloseRedFlag(input: {
  status: string;
  closureEvidence?: string | null;
  exceptionReason?: string | null;
  exceptionApproved: boolean;
}) {
  if (input.status !== "resolved") return false;
  if (input.closureEvidence?.trim()) return true;
  return Boolean(input.exceptionReason?.trim() && input.exceptionApproved);
}
