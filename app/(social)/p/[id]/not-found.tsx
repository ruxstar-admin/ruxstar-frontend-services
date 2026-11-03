import { ButtonLink } from "@/components/ui";
import { Empty } from "@/components/social/PostList";

export default function PostNotFound() {
  return (
    <Empty title="This post is not here">
      <p>It may have been deleted, or the link is wrong.</p>
      <ButtonLink href="/feed" variant="secondary">
        Go to feed
      </ButtonLink>
    </Empty>
  );
}
