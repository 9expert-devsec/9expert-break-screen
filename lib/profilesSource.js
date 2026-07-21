/* ============================================================
   profilesSource — SERVER ONLY (no 'use client')
   Fetches the full { [slug]: profileValue } map from MSDB's
   token-gated endpoint (PROMPT 02), with a build-time static
   fallback so the projector never goes blank and `next build`
   never fails when MSDB is unreachable.

   NEVER a runtime hard-dependency on MSDB: on ANY failure we
   return the bundled seed (public/profiles.json).
   ============================================================ */
import staticSeed from "@/public/profiles.json"; // build-time fallback seed

// Returns the full { [slug]: profileValue } map. Never throws; on any
// failure returns the bundled seed.
export async function getAllProfiles() {
  const url = process.env.MSDB_PROFILES_URL;
  const key = process.env.MSDB_BREAK_SCREEN_API_KEY;
  if (!url || !key) return staticSeed;

  try {
    const res = await fetch(url, {
      headers: { "x-api-key": key },
      // ISR: cache the upstream read; the page's own revalidate drives freshness.
      // Tag lets /api/revalidate purge THIS fetch's Data Cache on-demand.
      next: { revalidate: 300, tags: ["break-profiles"] },
    });
    if (!res.ok) return staticSeed;
    const data = await res.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return staticSeed;
    return data;
  } catch {
    return staticSeed;
  }
}

export async function getProfile(slug) {
  const all = await getAllProfiles();
  return all[slug] || null;
}
