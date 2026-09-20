import { requireRole } from "@/server/auth";
import { Sidebar } from "@/ui/Sidebar";

export default async function OwnerLayout({ children }: LayoutProps<"/">) {
  const user = await requireRole("owner");

  return (
    <div className="min-h-dvh">
      <Sidebar
        shopName={user.shop.name}
        branch={user.shop.branch}
        userName={user.fullName}
      />
      <div className="pl-60">{children}</div>
    </div>
  );
}
