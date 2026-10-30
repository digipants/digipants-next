import type { Metadata } from "next";
import WorkspacePreview from "./WorkspacePreview";

export const metadata: Metadata = {
  title: "Client Workspace — illustrative preview | DigiPants",
  description: "An illustrative, synthetic preview of the future DigiPants Client Workspace. No real client accounts, transactions, or project data.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function ClientWorkspaceFirstGlimpsePage() {
  return <WorkspacePreview />;
}
