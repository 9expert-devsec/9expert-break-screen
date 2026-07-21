/* ============================================================
   /api/revalidate — on-demand ISR purge for a break-screen course.
   Called by MSDB after an admin saves a profile so the projector
   shows fresh data on the NEXT load instead of waiting out the
   300s ISR cycle.

   Two cache layers are busted:
     1. revalidatePath(path)   → the rendered course route (Full Route Cache)
     2. revalidateTag("break-profiles") → the shared upstream fetch in
        lib/profilesSource.js (Data Cache), which is keyed independently
        of the route and reused across pages/generateStaticParams.
   Auth: header `x-revalidate-token` must equal REVALIDATE_SECRET. Fail closed.
   ============================================================ */
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9-]+$/;
const PROFILES_TAG = "break-profiles";

export async function POST(req) {
  // 1. Auth — fail closed if secret is unset or token mismatches.
  const secret = process.env.REVALIDATE_SECRET;
  const token = req.headers.get("x-revalidate-token");
  if (!secret || token !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 2. Resolve the target path: explicit ?path=/slug wins; else build from slug.
  const { searchParams } = new URL(req.url);
  const explicitPath = searchParams.get("path");

  let body = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {}; // body is optional when ?path= is provided
  }
  const slug = body?.slug;

  let path;
  if (explicitPath) {
    path = explicitPath;
  } else if (typeof slug === "string" && SLUG_RE.test(slug)) {
    path = `/${slug}`;
  } else {
    return NextResponse.json(
      { ok: false, error: "Provide ?path=/<slug> or a body { slug } matching ^[a-z0-9-]+$" },
      { status: 400 }
    );
  }

  // 3 + 4. Bust the rendered page AND the shared upstream fetch (Data Cache).
  const revalidated = [];
  revalidatePath(path);
  revalidated.push(path);
  revalidateTag(PROFILES_TAG);
  revalidated.push(PROFILES_TAG);

  // Note: home path "/" is NOT revalidated — app/page.jsx renders <BreakScreen />
  // client-side and does not call getAllProfiles, so it has no server ISR data.

  // 5.
  return NextResponse.json({ ok: true, revalidated, now: Date.now() });
}
