import { requireRole } from "@/server/auth";
import { loadProofLog } from "@/server/deliveries";
import { AppHeader } from "@/ui/AppHeader";
import { ProofLog } from "./ProofLog";

export const metadata = { title: "Proof log · Taslaafa" };
export const dynamic = "force-dynamic";

export default async function ProofLogPage() {
  await requireRole("owner", "staff");
  const deliveries = await loadProofLog(200);

  return (
    <>
      <AppHeader title="Proof log" subtitle="Every delivery, permanently" />
      <ProofLog deliveries={deliveries} now={Date.now()} />
    </>
  );
}
