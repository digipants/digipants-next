import { createHash, randomUUID } from "node:crypto";

type InvitationTransaction = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
};

type InvitationDatabase = {
  $transaction<T>(operation: (tx: InvitationTransaction) => Promise<T>): Promise<T>;
};

export const INVITATION_HEADER = "x-digipants-workspace-invitation";

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Consume a scoped invitation and create only a principal. Tenant membership
 * and project grants remain a separate, explicit staff action.
 */
export async function redeemClientInvitation(input: {
  workspaceDb: InvitationDatabase;
  token: string;
  intendedEmail: string;
  providerSubject: string;
}): Promise<boolean> {
  const { workspaceDb, token, intendedEmail, providerSubject } = input;
  if (
    typeof token !== "string" || token.length < 32 || token.length > 512 ||
    typeof intendedEmail !== "string" || intendedEmail.length < 3 || intendedEmail.length > 320 ||
    typeof providerSubject !== "string" || providerSubject.length < 1 || providerSubject.length > 255
  ) {
    return false;
  }

  const invitationHash = hashInvitationToken(token);
  const principalId = randomUUID();

  try {
    return await workspaceDb.$transaction(async (tx) => {
      const invitations = await tx.$queryRaw<Array<{
        id: string;
        intendedEmail: string;
      }>>`
        SELECT id::text AS id, intended_email AS "intendedEmail"
          FROM workspace_invitation_records
         WHERE invitation_token_hash = ${invitationHash}
           AND status = 'pending'
           AND expires_at > statement_timestamp()
         FOR UPDATE
      `;
      const invitation = invitations[0];
      if (!invitation || invitation.intendedEmail.toLowerCase() !== intendedEmail.toLowerCase()) {
        return false;
      }

      await tx.$executeRaw`
        INSERT INTO workspace_principals (id, provider, provider_subject, kind, status)
        VALUES (${principalId}::uuid, 'better_auth', ${providerSubject}, 'client', 'active')
      `;

      const changed = await tx.$executeRaw`
        UPDATE workspace_invitation_records
           SET status = 'redeemed',
               redeemed_by_client_id = ${principalId}::uuid,
               redeemed_at = statement_timestamp()
         WHERE id = ${invitation.id}::uuid
           AND invitation_token_hash = ${invitationHash}
           AND status = 'pending'
           AND expires_at > statement_timestamp()
      `;
      if (changed !== 1) throw new Error("Invitation was no longer redeemable.");
      return true;
    });
  } catch {
    // All failures deny enrollment. The caller gets the same generic result
    // for missing, expired, replayed and mismatched invitation records.
    return false;
  }
}
