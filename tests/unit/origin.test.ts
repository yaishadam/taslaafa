import { afterEach, describe, expect, it, vi } from "vitest";
import { appOrigin } from "@/lib/origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("appOrigin", () => {
  it("prefers what was set deliberately", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://taslaafa.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "taslaafa.vercel.app");
    expect(appOrigin()).toBe("https://taslaafa.app");
  });

  it("drops a trailing slash so links do not double up", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://taslaafa.app/");
    expect(appOrigin()).toBe("https://taslaafa.app");
  });

  it("falls back to the production deployment, not the preview it runs on", () => {
    // A link handed to a customer has to outlive the preview that made it.
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "taslaafa.vercel.app");
    vi.stubEnv("VERCEL_URL", "taslaafa-git-branch-xyz.vercel.app");
    expect(appOrigin()).toBe("https://taslaafa.vercel.app");
  });

  it("adds the scheme Vercel leaves off", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "something.vercel.app");
    expect(appOrigin()).toBe("https://something.vercel.app");
  });

  it("never returns a bare path, which is what the old fallback did", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(appOrigin()).toBe("http://localhost:3000");
    expect(appOrigin().startsWith("http")).toBe(true);
  });
});
