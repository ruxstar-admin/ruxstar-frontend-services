import { PostGridSkeleton } from "@/components/social/PostGrid";
import { Skeleton } from "@/components/ui";
import styles from "../profile.module.css";

/** The profile's shape while the server fetches it, so the header does not jump in. */
export default function ProfileLoading() {
  return (
    <div className={styles.page} aria-busy aria-label="Loading profile">
      <div className={styles.header}>
        <div className={styles.photo}>
          <Skeleton width="var(--avatar)" height="var(--avatar)" radius="50%" />
        </div>
        <div className={styles.top}>
          <Skeleton width={160} height={28} />
        </div>
        <div className={styles.stats}>
          <Skeleton width={180} height={22} />
        </div>
        <div className={styles.about}>
          <Skeleton width={140} height={20} />
          <Skeleton width="70%" height={16} />
        </div>
      </div>
      <div className={styles.posts}>
        <div className={styles.tabs}>
          <span className={styles.tab} />
        </div>
        <PostGridSkeleton count={6} />
      </div>
    </div>
  );
}
