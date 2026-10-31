type EdgeContext = { next(): Promise<Response> };

/** Edge-owned per-client limit; no request-supplied identity reaches the app. */
export default async function workspaceAuthRateLimit(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  return context.next();
}

export const config = {
  path: "/api/auth/*",
  rateLimit: {
    windowLimit: 90,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
