import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocalWorkspaceTest, isWorkspaceEnabled } from "../../experiments/client-workspace-auth/src/workspace-runtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Client Workspace | DigiPants",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function WorkspaceEntryPage() {
  if (!isWorkspaceEnabled() || (isLocalWorkspaceTest() &&
      (process.env.WORKSPACE_CLIENT_HTTP_TEST_ENABLED !== "1" ||
       process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED !== "1"))) {
    notFound();
  }
  redirect("/workspace/login/");
}
