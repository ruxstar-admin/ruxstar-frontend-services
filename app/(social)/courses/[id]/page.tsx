import type { Metadata } from "next";
import { cache } from "react";
import { fetchPublicCourse } from "@/lib/api/coaching";
import { fetchListingReviews } from "@/lib/api/reviews";
import { CATEGORY_LABEL, feeLine, placeLine } from "@/lib/coaching";
import { CourseScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

/** The course itself is the same for everyone, so the page is cached; seats and your enrolments load in the browser. */
export const revalidate = 60;

/** None at build time: each course page is made on its first visit, then cached for `revalidate` seconds. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

/** Reviews that arrive with the page; "Show more reviews" loads the rest in the browser. */
const FIRST_REVIEWS = 5;

/** Shared by the page and its metadata, so a visit makes one API call. */
const load = cache(fetchPublicCourse);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await load((await params).id);
  if (!course) return { title: "Course · Ruxstar", robots: { index: false } };
  const title = `${course.title} · Ruxstar`;
  const description = `${CATEGORY_LABEL[course.category]} · ${placeLine(course)}. ${feeLine(course)}. By ${course.business.name}.`;
  const images = course.photo ? [{ url: course.photo.url, width: course.photo.width, height: course.photo.height, alt: course.title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/courses/${course.id}` },
    openGraph: { type: "website", siteName: "Ruxstar", url: `/courses/${course.id}`, title, description, images },
    twitter: { card: course.photo ? "summary_large_image" : "summary", title, description },
  };
}

export default async function CoursePage({ params }: Props) {
  const { id } = await params;
  const [course, reviews] = await Promise.all([load(id), fetchListingReviews("coaching", id, FIRST_REVIEWS)]);
  return <CourseScreen id={id} initial={course} reviews={course ? reviews : null} />;
}
