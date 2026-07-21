import { redirect } from "next/navigation";
import ProfilePicker from "@/components/ProfilePicker";

// Home = live profile picker (card grid). The picker fetches the same-origin
// proxy /api/profiles-list client-side, so it always reflects MSDB.
// Backward-compat: old links are /?course=<slug> → redirect to path /{slug}
// so ISR caches per-course. ?start= is preserved so autostart still works.
// #cfg= is a fragment (never sent to the server) so it is unaffected here.
export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const course = sp?.course;
  if (course) {
    const start = sp?.start;
    const target = `/${encodeURIComponent(course)}`;
    redirect(start != null ? `${target}?start=${encodeURIComponent(start)}` : target);
  }
  return <ProfilePicker />;
}
