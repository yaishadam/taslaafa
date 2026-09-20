import "server-only";
import { serviceClient } from "@/server/supabase";

/**
 * The write side of delivery codes.
 *
 * Storing a ciphertext is not the same as reading one, so this module is
 * importable by any route that creates or reissues a delivery. Nothing here
 * can turn a stored code back into digits -- that lives in
 * server/customerView.ts, which only the public customer page may import.
 *
 * Keeping the two apart is what lets the guard test stay strict: a route
 * mentioning code_ct would otherwise have to be allowlisted, and then the
 * allowlist would grow with every new route.
 */

export async function storeNewCode(
  deliveryId: string,
  codeHash: string,
  codeCt: string,
): Promise<{ error: string | null }> {
  const { error } = await serviceClient().from("delivery_code").insert({
    delivery_id: deliveryId,
    code_hash: codeHash,
    code_ct: codeCt,
  });

  return { error: error?.message ?? null };
}
