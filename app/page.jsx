import { redirect } from "next/navigation";
import BreakScreen from "@/components/BreakScreen";

// Home = institution default (DEFAULTS / #cfg= / localStorage).
// Backward-compat: old links are /?course=<slug> → redirect to path /{slug}
// so ISR caches per-course. #cfg= is a fragment (never sent to the server),
// so it is unaffected by this redirect and keeps working on both / and /{slug}.
// ?start= is read client-side in init() and must survive the redirect.
export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const course = sp?.course;
  if (course) {
    const start = sp?.start;
    const target = `/${encodeURIComponent(course)}`;
    redirect(start != null ? `${target}?start=${encodeURIComponent(start)}` : target);
  }
  return <BreakScreen />;
}
