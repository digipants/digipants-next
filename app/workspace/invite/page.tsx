import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WorkspaceInvitation from "./WorkspaceInvitation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Private invitation | DigiPants Client Workspace",
  description: "Private, invitation-only workspace onboarding.",
  robots: { index:false, follow:false },
  referrer: "no-referrer",
};

export default function WorkspaceInvitePage() {
  // The whole link-exchange flow is local-only. Production and Netlify preview
  // must never render a bearer-token form from a different deployment origin.
  if (process.env.NODE_ENV === "production" ||
      process.env.AUTH_EXPERIMENT_ENABLED !== "1" ||
      process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED !== "1" ||
      process.env.WORKSPACE_MAIL_PROOF_TEST_ENABLED !== "1") notFound();
  return <WorkspaceInvitation />;
}
