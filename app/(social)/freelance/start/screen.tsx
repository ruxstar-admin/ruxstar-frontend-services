"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { ProfileFields } from "@/components/gigs/fields";
import { freelancerStarted, useFreelancing } from "@/components/gigs/use-gigs";
import { formError } from "@/lib/api/account";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { startFreelancing, type GigsRules } from "@/lib/api/gigs";
import { emptyProfile, percentText, profileErrors, toProfileInput, type ProfileDraft } from "@/lib/gigs";
import vendor from "@/components/vendor/vendor.module.css";

function StartForm({ rules }: { rules: GigsRules }) {
  const router = useRouter();
  const me = useMe();
  const [draft, setDraft] = useState<ProfileDraft>(() => emptyProfile(me?.name ?? "", rules.categories[0]?.key ?? ""));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef<{ sig: string; key: string } | null>(null);
  const errors = profileErrors(draft);
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const start = async () => {
    setShown(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setFailure(null);
    const body = toProfileInput(draft);
    const sig = JSON.stringify(body);
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: newIdempotencyKey() };
    try {
      await startFreelancing(body, attempt.current.key);
      freelancerStarted();
      router.replace("/freelance?fresh=1");
    } catch (err) {
      if (!keepIdempotencyKey(err)) attempt.current = null;
      setFailure(formError(err).message);
      setBusy(false);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href="/freelance">Freelancing</Back>
      <h1 className={vendor.title}>Start freelancing</h1>
      <ul className={vendor.rows}>
        <li className={vendor.row}>
          <Icon name="briefcase" size={20} />
          <span className={vendor.rowText}>
            <span className={vendor.rowTitle}>Sell your skills as gigs</span>
            <span className={vendor.rowLine}>{`Up to ${rules.maxGigs} gigs, each with up to ${rules.maxPackages} packages.`}</span>
          </span>
        </li>
        <li className={vendor.row}>
          <Icon name="shield" size={20} />
          <span className={vendor.rowText}>
            <span className={vendor.rowTitle}>Ruxstar holds the money</span>
            <span className={vendor.rowLine}>Customers pay up front. You’re paid once they approve, or by itself after a few days.</span>
          </span>
        </li>
        <li className={vendor.row}>
          <Icon name="wallet" size={20} />
          <span className={vendor.rowText}>
            <span className={vendor.rowTitle}>{`Ruxstar keeps ${percentText(rules.commissionBps)}`}</span>
            <span className={vendor.rowLine}>Of each order’s price. You see what you get on every order.</span>
          </span>
        </li>
      </ul>
      <p className={vendor.faint}>You can sell once your identity is verified. Set up your profile now and verify after.</p>
      <form
        className={vendor.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
      >
        <ProfileFields draft={draft} set={set} errors={shown ? errors : {}} categories={rules.categories} />
        {failure && (
          <p className={vendor.error} role="alert">
            {failure}
          </p>
        )}
        <div className={vendor.actions}>
          <Button type="submit" size="lg" loading={busy}>
            Create my profile
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Making your freelancer profile: who you are and what you do. Verifying and gigs come after. */
export function StartFreelancingScreen() {
  const { data, error, reload } = useFreelancing("start");
  if (data?.me) {
    return (
      <Empty title="You’ve started already">
        <p>Your freelancer profile is ready.</p>
        <ButtonLink href="/freelance" variant="secondary">
          Open Freelancing
        </ButtonLink>
      </Empty>
    );
  }
  if (data && data.rules.live && data.rules.signupsOpen) return <StartForm rules={data.rules} />;
  if (data) {
    return (
      <Empty title="Not taking new freelancers yet">
        <p>Ruxstar opens freelancing to new people soon. Check back later.</p>
      </Empty>
    );
  }
  if (error) return <Failed error={error} onRetry={reload} />;
  return <Loading rows={4} />;
}
