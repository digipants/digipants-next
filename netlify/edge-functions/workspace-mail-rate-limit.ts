type EdgeContext = { next(): Promise<Response> };

/** Separate low-volume limit for invitation mailbox proof requests. */
export default async function workspaceMailRateLimit(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  return context.next();
}

export const config = {
  path: ["/api/workspace/invites/proof", "/api/workspace/invites"],
  rateLimit: {
    windowLimit: 12,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
