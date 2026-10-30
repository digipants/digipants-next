/**
 * Safe client-facing projection of a VERIFIED, tenant-scoped publication row.
 * This is display formatting, NOT authentication or an authorization gate.
 * Verified sessions, active grants, current project publication status and
 * retractions must be checked on the server before this function is called.
 */
export type SharedClientView = Readonly<{
  id: string; kind: "progress" | "document"; resourceId: string;
  version: number; title: string; summary: string; publishedAt: string;
}>;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const validId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);
const validText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max &&
  !/[\u0000-\u001f\u007f]/.test(value);

/** Discards every internal field, particularly the private storage reference. */
export function formatVerifiedSharingRow(
  input: unknown,
  scope: { tenantId: string; projectId: string },
): SharedClientView | null {
  try {
    const tenantId = scope.tenantId, projectId = scope.projectId;
    if (!validId(tenantId) || !validId(projectId) ||
        !input || typeof input !== "object" || Array.isArray(input)) return null;
    const row = input as Record<string, unknown>;
    // Capture accessors only once; malformed or changing values fail closed.
    const id = row.id, kind = row.kind, resourceId = row.resourceId;
    const rowTenantId = row.tenantId, rowProjectId = row.projectId;
    const version = row.version, title = row.title, summary = row.summary;
    const publishedAt = row.publishedAt;
    const projectPublished = row.projectPublished;
    const published = row.published, retracted = row.retracted;
    if (!validId(id) || !validId(resourceId) ||
        rowTenantId !== tenantId || rowProjectId !== projectId ||
        (kind !== "progress" && kind !== "document") ||
        !Number.isSafeInteger(version) || (version as number) < 1 ||
        !validText(title, 200) || !validText(summary, 8000) ||
        projectPublished !== true || published !== true || retracted !== false ||
        !(publishedAt instanceof Date) || !Number.isFinite(publishedAt.getTime())) return null;
    return Object.freeze({
      id, kind, resourceId, version: version as number,
      title, summary, publishedAt: publishedAt.toISOString(),
    });
  } catch {
    return null;
  }
}
