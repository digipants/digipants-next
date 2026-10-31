import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WorkspaceLogin from "./WorkspaceLogin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Sign in | DigiPants Client Workspace",
  description: "Private, invitation-only project access.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function WorkspaceLoginPage() {
  if (process.env.NODE_ENV === "production" ||
      process.env.AUTH_EXPERIMENT_ENABLED !== "1" ||
      process.env.WORKSPACE_CLIENT_HTTP_TEST_ENABLED !== "1" ||
      process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED !== "1") {
    notFound();
  }
  return <WorkspaceLogin />;
}
