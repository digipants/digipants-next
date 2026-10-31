import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WorkspaceProject from "./WorkspaceProject";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Private project | DigiPants Client Workspace",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Only public information here is that a private workspace route exists. */
export default async function ClientProjectPage(props: {
  params: Promise<{ tenantId: string; projectId: string }>;
}) {
  if (process.env.NODE_ENV === "production" ||
      process.env.AUTH_EXPERIMENT_ENABLED !== "1" ||
      process.env.WORKSPACE_CLIENT_HTTP_TEST_ENABLED !== "1" ||
      process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED !== "1") {
    notFound();
  }
  const { tenantId, projectId } = await props.params;
  if (!UUID.test(tenantId) || !UUID.test(projectId)) notFound();
  // Project identity and publication authorization happen only at the API,
  // against server-owned Better Auth session, MFA and restricted SQL grant.
  return <WorkspaceProject tenantId={tenantId.toLowerCase()} projectId={projectId.toLowerCase()} />;
}
