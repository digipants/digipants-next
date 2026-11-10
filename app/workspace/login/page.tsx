import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WorkspaceLogin from "./WorkspaceLogin";
import {
  isLocalWorkspaceTest, isProtectedWorkspaceStaging, isWorkspaceEnabled,
} from "../../../experiments/client-workspace-auth/src/workspace-runtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Sign in | DigiPants Client Workspace",
  description: "Private, invitation-only project access.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function WorkspaceLoginPage() {
  if (!isWorkspaceEnabled() || (isLocalWorkspaceTest() &&
      (process.env.WORKSPACE_CLIENT_HTTP_TEST_ENABLED !== "1" ||
       process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED !== "1"))) {
    notFound();
  }
  const defaultProjectPath = isProtectedWorkspaceStaging()
    ? "/workspace/tenants/11111111-1111-4111-8111-111111111111/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/"
    : undefined;
  return <WorkspaceLogin defaultProjectPath={defaultProjectPath} />;
}
