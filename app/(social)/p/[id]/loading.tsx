import { PostSkeleton } from "@/components/social/PostCard";
import styles from "@/components/social/social.module.css";

export default function PostLoading() {
  return (
    <div className={styles.column} aria-busy aria-label="Loading post">
      <PostSkeleton />
    </div>
  );
}
