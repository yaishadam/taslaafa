import { AppHeader } from "@/ui/AppHeader";
import { Empty } from "@/ui/primitives";

export const metadata = { title: "Staff · Taslaafa" };

/**
 * A placeholder, not a screen. The tab bar is specified with four tabs, and
 * a tab that goes nowhere is worse than one that says so.
 */
export default function StaffPage() {
  return (
    <>
      <AppHeader title="Staff" />
      <div className="mx-auto max-w-md px-5 py-6">
        <Empty
          title="Not built yet"
          body="Accounts are created by hand for now. This is where adding and removing riders will live."
        />
      </div>
    </>
  );
}
