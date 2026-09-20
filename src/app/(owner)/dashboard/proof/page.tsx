import { requireRole } from "@/server/auth";
import { loadProofLog } from "@/server/deliveries";
import { ProofLog } from "@/app/(shop)/proof/ProofLog";

export const metadata = { title: "Proof log · Taslaafa" };
export const dynamic = "force-dynamic";

export default async function OwnerProofPage() {
  await requireRole("owner");
  const deliveries = await loadProofLog(200);

  return (
    <div className="px-8 py-8">
      <h1 className="text-2xl">Proof log</h1>
      <p className="mt-1 text-ink-2">
        Every delivery this shop has made. Nothing here can be edited or
        removed.
      </p>
      <div className="mt-6 -mx-5">
        <ProofLog deliveries={deliveries} now={Date.now()} />
      </div>
    </div>
  );
}
