/* ============================================================
   /api/profiles-list — SAME-ORIGIN proxy for the home picker.
   The browser must never call MSDB directly (the api-key is
   server-only + cross-origin CORS). This route runs server-side,
   reuses getAllProfiles() (key + tag + seed fallback already there),
   and returns only the MINIMAL fields the card grid needs.
   ============================================================ */
import { NextResponse } from "next/server";
import { getAllProfiles } from "@/lib/profilesSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const all = await getAllProfiles(); // { [slug]: { label, courses, videos } }
    const profiles = Object.entries(all).map(([slug, p]) => {
      const first = Array.isArray(p?.courses) ? p.courses.find((c) => c?.img) : null;
      return {
        slug,
        label: (p?.label || "").trim() || slug,
        image: first?.img || null,
      };
    });
    return NextResponse.json(
      { ok: true, profiles },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    // Degrade gracefully — the picker treats [] as its empty state.
    return NextResponse.json(
      { ok: true, profiles: [] },
      { headers: { "cache-control": "no-store" } }
    );
  }
}
