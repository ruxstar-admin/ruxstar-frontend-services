"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui";
import { useMe, useSignInFirst } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { formError } from "@/lib/api/account";
import { listingReviews, type ListingModule, type Review } from "@/lib/api/reviews";
import type { Page } from "@/lib/api/social";
import { ReportForm, ReviewCard, TextAction } from "./Reviews";
import order from "@/components/shop/order.module.css";
import styles from "./reviews.module.css";

/** Later pages, after the few the server put in the page. */
const PAGE_SIZE = 10;

/**
 * An event's or a course's reviews, newest first: the first few arrive with the page, "Show more reviews" loads the
 * rest. Anyone signed in can report one. Same as a print shop's reviews.
 */
export function ListingReviews({ module, id, initial }: { module: ListingModule; id: string; initial: Page<Review> }) {
  const me = useMe();
  const signIn = useSignInFirst();
  const load = useCallback((cursor?: string) => listingReviews(module, id, cursor, PAGE_SIZE), [module, id]);
  const { items, loadingMore, hasMore, moreFailed, error, more } = usePages(load, initial);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reported, setReported] = useState<string[]>([]);

  if (!items.length) return null;

  return (
    <section className={order.section}>
      <h2 className={order.overline}>{module === "events" ? "Reviews of this event" : "Reviews of this course"}</h2>
      <div className={styles.list}>
        {items.map((review) =>
          reporting === review.id ? (
            <ReportForm
              key={review.id}
              reviewId={review.id}
              module={module}
              onClose={() => setReporting(null)}
              onDone={() => {
                setReporting(null);
                setReported((prev) => [...prev, review.id]);
              }}
            />
          ) : (
            <ReviewCard key={review.id} review={review} hideProduct>
              {me && review.author?.id === me.id ? null : reported.includes(review.id) ? (
                <span className={styles.faint}>Reported. Thanks for telling us.</span>
              ) : (
                <div className={styles.actions}>
                  <TextAction muted onClick={() => (me ? setReporting(review.id) : signIn())}>
                    Report
                  </TextAction>
                </div>
              )}
            </ReviewCard>
          ),
        )}
      </div>
      {moreFailed && error ? (
        <p className={order.error} role="alert">
          {formError(error).message}
        </p>
      ) : null}
      {hasMore && (
        <div>
          <Button variant="secondary" loading={loadingMore} onClick={more}>
            {moreFailed ? "Try again" : "Show more reviews"}
          </Button>
        </div>
      )}
    </section>
  );
}
