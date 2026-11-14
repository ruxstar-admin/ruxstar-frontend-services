"use client";

import { useRouter } from "next/navigation";
import { Composer } from "@/components/social/Composer";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { ButtonLink, Icon } from "@/components/ui";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { getWork } from "@/lib/api/team";
import styles from "@/components/vendor/vendor.module.css";

/** Posting for the business someone works at. It goes out under the owner's name, on the business's tab. Same as the app. */
export function TeamPostScreen({ placeId }: { placeId: string }) {
  const me = useMe();
  const router = useRouter();
  const { data, error, reload } = useLoad(() => getWork(), placeId);
  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data || !me) return <Loading rows={2} />;
  const place = data.places.find((p) => p.id === placeId);

  if (!place || place.access !== "on" || !place.permissions.includes("posts.create")) {
    return (
      <Empty title="Not open to you">
        <p>The owner hasn&apos;t allowed you to post for this business, or you&apos;re no longer on its team.</p>
        <ButtonLink href={`/work/${placeId}`} variant="secondary">
          Back to Work
        </ButtonLink>
      </Empty>
    );
  }

  return (
    <div className={styles.page}>
      <Back href={`/work/${placeId}`}>{place.business.name}</Back>
      <h1 className={styles.title}>Post as the business</h1>
      <p className={styles.note}>
        <Icon name="info" size={20} />
        <span>{`Posts for ${place.business.name}, under ${place.owner.name}’s name. It shows on the business tab and in the feed.`}</span>
      </p>
      <Composer me={me} kind="business" businessId={place.business.id} onPosted={() => router.push(`/work/${placeId}`)} />
    </div>
  );
}
