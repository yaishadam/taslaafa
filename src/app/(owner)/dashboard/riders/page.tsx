import { sessionClient, requireRole } from "@/server/auth";
import { Card } from "@/ui/primitives";

export const metadata = { title: "Riders · Taslaafa" };
export const dynamic = "force-dynamic";

export default async function RidersPage() {
  await requireRole("owner");
  const supabase = await sessionClient();

  const { data } = await supabase
    .from("app_user")
    .select("id, full_name, role, is_active")
    .order("role")
    .order("full_name");

  const people = data ?? [];

  return (
    <div className="max-w-3xl px-8 py-8">
      <h1 className="text-2xl">Riders and staff</h1>
      <p className="mt-1 text-ink-2">
        Accounts are created by hand for now. Adding and removing people comes
        later.
      </p>

      <Card className="mt-6 divide-y divide-hairline p-0">
        {people.map((person) => (
          <div
            key={person.id as string}
            className="flex items-center justify-between px-5 py-4"
          >
            <div>
              <p className="font-bold text-ink">{person.full_name as string}</p>
              <p className="text-[13px] text-ink-3 capitalize">
                {person.role as string}
              </p>
            </div>
            {!person.is_active ? (
              <span className="text-[13px] font-bold text-ink-3">Inactive</span>
            ) : null}
          </div>
        ))}
      </Card>
    </div>
  );
}
