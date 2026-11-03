/** Only a canonical opaque 32-byte base64url invitation fragment is accepted. */
const FRAGMENT = /^#invite=([A-Za-z0-9_-]{43})$/;

/**
 * Fail closed if an invitation token cannot be removed from browser history.
 * The caller must not copy it to storage, analytics, referrer, route/query
 * or a third-party service. Exact fragment parsing forbids appended payloads.
 */
export function consumePrivateInvitationFragment(hash: unknown, scrub: () => void): string | null {
  if (typeof scrub !== "function") return null;
  try {
    scrub();
    if (typeof hash !== "string") return null;
    const match = FRAGMENT.exec(hash);
    return match ? match[1]! : null;
  } catch {
    return null;
  }
}
