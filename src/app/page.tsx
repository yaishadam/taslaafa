import { redirect } from "next/navigation";
import { HOME_FOR, requireUser } from "@/server/auth";

/**
 * There is no landing page. Everyone who arrives here belongs somewhere
 * specific, and this works out where.
 *
 * Sign-in sends people here rather than guessing a destination, so the role
 * lookup happens in exactly one place.
 */
export default async function Root() {
  const user = await requireUser();
  redirect(HOME_FOR[user.role]);
}
