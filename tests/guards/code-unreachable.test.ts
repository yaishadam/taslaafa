import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * RULE 2, the reachability half.
 *
 * code-visibility.test.ts checks that nothing *directly* imports the module
 * that decrypts a code. That is not the same claim as "no authenticated API
 * route can ever return it", because a route could reach it through two or
 * three hops -- a helper importing a helper importing customerView -- and
 * the shallow check would pass.
 *
 * So this one walks the whole import graph. For every entry point the shop
 * or a driver can reach, it computes everything transitively reachable and
 * asserts that server/customerView.ts is not in that set.
 *
 * The alternative was to run the real routes over HTTP and scan the response
 * bodies. That needs a live server and a hand-built Supabase session cookie
 * in the @supabase/ssr chunked format, and it would only catch a leak that
 * this check already proves impossible: a route cannot return a plaintext
 * code without, somewhere in its graph, reaching the only function that can
 * produce one. This is faster, hermetic, and does not go red because a dev
 * server was not running.
 */

const SRC = path.resolve(import.meta.dirname, "..", "..", "src");

/** The one file allowed to reach the code, and the module it reaches. */
const PUBLIC_PAGE = "app/d/[token]/page.tsx";
const REVEALING_MODULE = "server/customerView.ts";

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ALL = walk(SRC)
  .filter((f) => /\.(ts|tsx)$/.test(f))
  .map((f) => path.relative(SRC, f).split(path.sep).join("/"));

function read(rel: string): string {
  return readFileSync(path.join(SRC, rel), "utf8");
}

/** Resolve an import specifier to a file under src, or null if it leaves. */
function resolve(fromRel: string, spec: string): string | null {
  let base: string;

  if (spec.startsWith("@/")) {
    base = spec.slice(2);
  } else if (spec.startsWith("./") || spec.startsWith("../")) {
    base = path
      .join(path.dirname(fromRel), spec)
      .split(path.sep)
      .join("/");
  } else {
    // A package. Nothing in node_modules can reach our code.
    return null;
  }

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];

  return candidates.find((c) => ALL.includes(c)) ?? null;
}

const IMPORT = /(?:from|import)\s*["']([^"']+)["']/g;

function importsOf(rel: string): string[] {
  const text = read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  const out: string[] = [];
  for (const match of text.matchAll(IMPORT)) {
    const resolved = resolve(rel, match[1]);
    if (resolved) out.push(resolved);
  }
  return out;
}

/** Everything reachable from a file, following imports as far as they go. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length) {
    const current = queue.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...importsOf(current));
  }

  seen.delete(entry);
  return seen;
}

/** Route handlers, pages and layouts -- every way into the app. */
const ENTRY_POINTS = ALL.filter(
  (f) =>
    f.startsWith("app/") &&
    /\/(route|page|layout)\.tsx?$/.test(f) &&
    f !== PUBLIC_PAGE,
);

describe("the import graph", () => {
  it("found the entry points it is supposed to be checking", () => {
    // If a refactor moves the app directory, this test would otherwise pass
    // by checking nothing at all -- the worst possible way for a guard to
    // succeed.
    expect(ENTRY_POINTS.length).toBeGreaterThanOrEqual(8);
    expect(ENTRY_POINTS.filter((f) => f.includes("/api/")).length)
      .toBeGreaterThanOrEqual(2);
  });

  it("still has the public customer page where it is expected", () => {
    expect(ALL).toContain(PUBLIC_PAGE);
    expect(ALL).toContain(REVEALING_MODULE);
  });

  it("lets the public customer page reach the code, as it must", () => {
    expect(reachableFrom(PUBLIC_PAGE)).toContain(REVEALING_MODULE);
  });

  it.each(ENTRY_POINTS)(
    "%s cannot reach a plaintext code, however many hops away",
    (entry) => {
      const reachable = reachableFrom(entry);

      expect(
        [...reachable].filter((f) => f === REVEALING_MODULE),
        `${entry} can reach ${REVEALING_MODULE} through its imports. ` +
          `Trace the chain and break it -- a route that can reach that ` +
          `module can return a code, whether or not it does today.`,
      ).toEqual([]);
    },
  );

  it("only the public page reaches revealCode at all", () => {
    const reachers = ALL.filter(
      (f) =>
        f !== "server/codes.ts" &&
        /\brevealCode\b/.test(
          read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
        ),
    );

    expect(reachers).toEqual([REVEALING_MODULE]);
  });
});

describe("the guard set is intact", () => {
  it("guards-intact.test.ts is still present", () => {
    expect(
      existsSync(path.resolve(import.meta.dirname, "guards-intact.test.ts")),
    ).toBe(true);
  });
});
