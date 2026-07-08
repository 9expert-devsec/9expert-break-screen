// app/api/revalidate/route.js
// On-demand ISR revalidation receiver. MSDB fires a POST here after a
// break-screen profile write so the affected /{slug} page refreshes in
// seconds. This is an optimization on top of the 5-min ISR — if the call
// fails, ISR still catches up, so nothing breaks. POST-only (GET → 405).
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a, b) {
  const ab = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req) {
  const secret = process.env.REVALIDATE_SECRET || "";
  const provided =
    req.headers.get("x-revalidate-secret") ||
    new URL(req.url).searchParams.get("secret") ||
    "";

  if (!secret || !safeEqual(provided, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Accept { slug } and/or { slugs: [...] }; also revalidate "/" so the picker/home stays fresh.
  const slugs = new Set();
  if (typeof body.slug === "string" && body.slug.trim()) slugs.add(body.slug.trim());
  if (Array.isArray(body.slugs)) {
    for (const s of body.slugs) if (typeof s === "string" && s.trim()) slugs.add(s.trim());
  }

  const revalidated = [];
  try {
    for (const s of slugs) {
      revalidatePath(`/${s}`);
      revalidated.push(`/${s}`);
    }
    // Home also reads the profile set indirectly (picker); refresh it too.
    revalidatePath("/");
    revalidated.push("/");
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "revalidate failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, revalidated }, { status: 200 });
}
