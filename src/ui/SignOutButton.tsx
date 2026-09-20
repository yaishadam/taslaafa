"use client";

import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase-browser";
import { IconSignOut } from "@/ui/icons";
import { IconButton } from "@/ui/primitives";

export function SignOutButton() {
  const router = useRouter();

  return (
    <IconButton
      label="Sign out"
      onClick={async () => {
        await browserClient().auth.signOut();
        router.replace("/signin");
        router.refresh();
      }}
    >
      <IconSignOut size={20} />
    </IconButton>
  );
}
