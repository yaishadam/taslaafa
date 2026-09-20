import { AppHeader } from "@/ui/AppHeader";
import { Empty } from "@/ui/primitives";

export const metadata = { title: "Settings · Taslaafa" };

/**
 * A placeholder, not a screen. The tab bar is specified with four tabs, and
 * a tab that goes nowhere is worse than one that says so.
 */
export default function SettingsPage() {
  return (
    <>
      <AppHeader title="Settings" />
      <div className="mx-auto max-w-md px-5 py-6">
        <Empty
          title="Not built yet"
          body="Shop name, branch and the default promise time are set in the database for now."
        />
      </div>
    </>
  );
}
