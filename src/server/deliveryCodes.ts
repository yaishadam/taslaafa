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

/**
 * Replaces the code on a locked delivery. Owner only, checked by the route.
 *
 * The public token does not change, so the customer's existing link simply
 * starts showing the new digits -- nothing has to be re-shared into the
 * thread. The old code's three failures stay in the log; reissue_code adds a
 * row rather than resetting anything.
 */
export async function reissueCode(
  deliveryId: string,
  actorId: string,
  codeHash: string,
  codeCt: string,
): Promise<{ result: string; error: string | null }> {
  const { data, error } = await serviceClient().rpc('reissue_code', {
    p_delivery_id: deliveryId,
    p_actor_id: actorId,
    p_code_hash: codeHash,
    p_code_ct: codeCt,
  });

  if (error) return { result: 'error', error: error.message };
  return { result: (data as { result: string }).result, error: null };
}
