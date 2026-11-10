import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WorkspaceInvitation from "./WorkspaceInvitation";
import { isLocalWorkspaceTest, isWorkspaceEnabled } from "../../../experiments/client-workspace-auth/src/workspace-runtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Private invitation | DigiPants Client Workspace",
  description: "Private, invitation-only workspace onboarding.",
  robots: { index:false, follow:false },
  referrer: "no-referrer",
};

export default function WorkspaceInvitePage() {
  // Only the explicitly enabled local harness or protected staging project
  // may render the private mailbox-proof flow.
  if (!isWorkspaceEnabled() || (isLocalWorkspaceTest() &&
      (process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED !== "1" ||
       process.env.WORKSPACE_MAIL_PROOF_TEST_ENABLED !== "1"))) notFound();
  return <WorkspaceInvitation />;
}
