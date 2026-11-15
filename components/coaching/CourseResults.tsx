"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { FilterRow, FilterSelect } from "@/components/shop/FilterSelect";
import { ShopCardSkeleton } from "@/components/shop/ShopCard";
import { formError } from "@/lib/api/account";
import { listCourses, type CourseCategory, type CourseFilters } from "@/lib/api/coaching";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/coaching";
import { CourseCard } from "./CourseCard";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/shop.module.css";

type Where = "any" | "online" | "offline";
const WHERE: { value: Where; label: string }[] = [
  { value: "any", label: "Online & in person" },
  { value: "online", label: "Online" },
  { value: "offline", label: "In person" },
];

function Cards({ filters }: { filters: CourseFilters }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => listCourses(filters, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) {
    return (
      <div className={styles.grid} aria-busy>
        <ShopCardSkeleton />
        <ShopCardSkeleton />
        <ShopCardSkeleton />
      </div>
    );
  }
  if (error && items.length === 0) {
    return (
      <div className={social.failed} role="alert">
        <p>{formError(error).message}</p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    const searching = Boolean(filters.q || filters.category || filters.online !== undefined);
    return (
      <Empty title={searching ? "No courses match" : "No courses yet"}>
        <p>{searching ? "Try another subject, name or way to learn." : "Tuition, music, dance and more on Ruxstar show up here as soon as institutes open their batches."}</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={styles.grid}>
        {items.map((course, i) => (
          <li key={course.id}>
            <CourseCard course={course} index={i} eager={i < 3} />
          </li>
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && (
        <div className={styles.grid} aria-busy>
          <ShopCardSkeleton />
        </div>
      )}
    </>
  );
}

/** Courses taking students, newest first, for Discover: filter by subject and online or in person; the search box matches titles and institutes. Same as the app. */
export default function CourseResults({ q }: { q: string }) {
  const [category, setCategory] = useState<CourseCategory | "">("");
  const [where, setWhere] = useState<Where>("any");
  const filters: CourseFilters = { ...(q ? { q } : {}), ...(category ? { category } : {}), ...(where === "any" ? {} : { online: where === "online" }) };
  return (
    <>
      <FilterRow label="Course filters">
        <FilterSelect label="In person or online" value={where} onChange={setWhere} options={WHERE} />
        <FilterSelect label="Subject" value={category} onChange={setCategory} options={[{ value: "", label: "All subjects" }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))]} />
      </FilterRow>
      <Cards key={`${q}|${category}|${where}`} filters={filters} />
    </>
  );
}
