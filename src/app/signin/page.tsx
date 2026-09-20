import { Logo } from "@/ui/Logo";
import { SignInForm } from "./SignInForm";

export const metadata = { title: "Sign in · Taslaafa" };

export default async function SignInPage({
  searchParams,
}: PageProps<"/signin">) {
  const params = await searchParams;
  const raw = params.next;

  // Only ever redirect back inside this app. An open redirect on a sign-in
  // page is how a convincing phishing link gets built.
  const candidate = typeof raw === "string" ? raw : "/";
  const next = candidate.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-12">
      <div className="space-y-5">
        <Logo size={36} />
        <div>
          <h1 className="text-2xl">Sign in</h1>
          <p className="mt-1 text-[15px] text-ink-2">
            Use the account your shop gave you.
          </p>
        </div>
      </div>

      <SignInForm next={next} />
    </main>
  );
}
