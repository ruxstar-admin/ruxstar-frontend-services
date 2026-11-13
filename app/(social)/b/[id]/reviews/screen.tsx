"use client";

import { useCallback, useEffect, useState } from "react";
import { ButtonLink, Icon, Skeleton } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useBack } from "@/components/social/Shell";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ReportForm, ReviewCard, TextAction } from "@/components/reviews/Reviews";
import { formError } from "@/lib/api/account";
import { shopReviews } from "@/lib/api/reviews";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/shop.module.css";
import reviews from "@/components/reviews/reviews.module.css";

/** All of a print shop's reviews, newest first. Anyone can report one. Same as the app. */
export function ShopReviewsScreen({ id }: { id: string }) {
  const back = useBack();
  const me = useMe();
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => shopReviews(id, cursor), [id]);
  const { items, loading, loadingMore, hasMore, error, more } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reported, setReported] = useState<string[]>([]);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  return (
    <div className={styles.shop}>
      <button type="button" className={social.back} onClick={back}>
        <Icon name="arrow-left" size={18} /> Back
      </button>
      <h1 className={styles.shopTitle}>Reviews</h1>
      {loading ? (
        <div className={reviews.list} aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={110} radius={18} />
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <Empty title="Could not load the reviews">
          <p>{formError(error).message}</p>
          <ButtonLink href={`/b/${id}`} variant="secondary">
            Back to the shop
          </ButtonLink>
        </Empty>
      ) : items.length === 0 ? (
        <Empty title="No reviews yet">
          <p>{"Customers can review an order once it's delivered."}</p>
        </Empty>
      ) : (
        <div className={reviews.list}>
          {items.map((review) =>
            reporting === review.id ? (
              <ReportForm
                key={review.id}
                reviewId={review.id}
                onClose={() => setReporting(null)}
                onDone={() => {
                  setReporting(null);
                  setReported((prev) => [...prev, review.id]);
                }}
              />
            ) : (
              <ReviewCard key={review.id} review={review}>
                {review.author?.id === me?.id ? null : reported.includes(review.id) ? (
                  <span className={reviews.faint}>Reported. Thanks for telling us.</span>
                ) : (
                  <div className={reviews.actions}>
                    <TextAction muted onClick={() => setReporting(review.id)}>
                      Report
                    </TextAction>
                  </div>
                )}
              </ReviewCard>
            ),
          )}
          {hasMore && <div ref={sentinel} aria-hidden />}
          {loadingMore && <Skeleton height={110} radius={18} />}
        </div>
      )}
    </div>
  );
}
