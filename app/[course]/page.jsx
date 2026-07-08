import BreakScreen from "@/components/BreakScreen";
import { getAllProfiles, getProfile } from "@/lib/profilesSource";

export const revalidate = 300; // 5 min ISR; tune later or add on-demand revalidation

// Pre-generate known slugs at build so the common courses are instantly CDN-served.
export async function generateStaticParams() {
  try {
    const all = await getAllProfiles();
    return Object.keys(all).map((course) => ({ course }));
  } catch {
    return [];
  }
}

// Allow slugs that appear after build (created in MSDB later) to be generated on-demand.
export const dynamicParams = true;

export default async function CoursePage({ params }) {
  const { course } = await params;
  const profile = await getProfile(course); // may be null → BreakScreen shows the "unknown profile" notice
  return <BreakScreen initialCourseSlug={course} initialProfile={profile} />;
}
