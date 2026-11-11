"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui";
import { getMe } from "@/lib/api/account";

const SIGN_IN_FIRST = "/signin?next=/search";

/** Search needs an account, so signed-out visitors sign in on the way. */
export function SearchPeopleLink() {
  const [href, setHref] = useState(SIGN_IN_FIRST);

  useEffect(() => {
    let live = true;
    getMe().then(
      () => live && setHref("/search"),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <ButtonLink href={href} variant="secondary">
      Search people
    </ButtonLink>
  );
}
