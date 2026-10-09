import { createHash } from "node:crypto";

export type InvitationGrant = {
  key: string;
  scopeType: string;
  domain: string | null;
};

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationSnapshotAllowsCurrentGrants(
  snapshot: unknown,
  grants: readonly InvitationGrant[],
): boolean {
  if (!Array.isArray(snapshot)) return false;
  const allowed = new Set(
    snapshot.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const grant = value as Partial<InvitationGrant>;
      if (typeof grant.key !== "string" || typeof grant.scopeType !== "string")
        return [];
      if (grant.domain !== null && typeof grant.domain !== "string") return [];
      return [
        `${grant.key}\u0000${grant.scopeType}\u0000${grant.domain ?? ""}`,
      ];
    }),
  );
  return grants.every((grant) =>
    allowed.has(
      `${grant.key}\u0000${grant.scopeType}\u0000${grant.domain ?? ""}`,
    ),
  );
}
