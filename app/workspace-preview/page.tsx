import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import WorkspacePreview from "./WorkspacePreview";

// This is an intentionally public, synthetic PR-only demo. Fail closed on
// the production domain and on ordinary branch deployments. This host check
// is NOT an authentication boundary for any future client data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Workspace — illustrative preview | DigiPants",
  description: "An illustrative, synthetic preview of the future DigiPants Client Workspace. No real client accounts, transactions, or project data.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function ClientWorkspaceFirstGlimpsePage() {
  const host = (await headers()).get("host")?.toLowerCase() ?? "";
  // Only Netlify pull-request preview hosts may display the mock UI.
  if (!/^deploy-preview-[1-9]\d*--digipants\.netlify\.app$/.test(host)) {
    notFound();
  }
  return <WorkspacePreview />;
}
