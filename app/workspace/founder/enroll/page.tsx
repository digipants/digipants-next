import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FounderEnrollment from "./FounderEnrollment";
import { getWorkspacePrisma } from "../../../../experiments/client-workspace-auth/src/database";
import { founderBootstrapEnabled } from "../../../../experiments/client-workspace-auth/src/founder-bootstrap";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Founder setup | DigiPants Client Workspace",
  description: "One-time protected founder account enrollment.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function FounderEnrollmentPage() {
  if (!founderBootstrapEnabled()) notFound();
  try {
    const rows = await getWorkspacePrisma().$queryRaw<Array<{ active: boolean }>>`
      SELECT public.cw_founder_bootstrap_active() AS active
    `;
    if (rows.length !== 1 || rows[0]?.active !== true) notFound();
  } catch {
    notFound();
  }
  return <FounderEnrollment />;
}
