"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, ButtonLink, Input } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { KeyedSelect } from "@/components/gigs/fields";
import { useFreelancing } from "@/components/gigs/use-gigs";
import { formError } from "@/lib/api/account";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { sendQuote, type GigsRules, type MyFreelancer } from "@/lib/api/gigs";
import { money } from "@/lib/api/shops";
import { emptyQuote, percentText, plural, priceRangeText, quoteErrors, rupeeInput, toQuoteInput, type QuoteDraft } from "@/lib/gigs";
import vendor from "@/components/vendor/vendor.module.css";

function Form({ rules, me, chatId, name }: { rules: GigsRules; me: MyFreelancer; chatId: string; name: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuoteDraft>(() => emptyQuote(rules.categories.some((c) => c.key === me.category) ? me.category : (rules.categories[0]?.key ?? ""), rules));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef<{ sig: string; key: string } | null>(null);
  const errors = quoteErrors(draft, rules);
  const err = (field: string) => (shown ? errors[field] : undefined);
  const set = <K extends keyof QuoteDraft>(key: K, value: QuoteDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const chat = `/messages/${chatId}`;

  const send = async () => {
    setShown(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setFailure(null);
    const body = toQuoteInput(draft);
    const sig = JSON.stringify(body);
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: newIdempotencyKey() };
    try {
      await sendQuote(chatId, body, attempt.current.key);
      router.replace(chat);
    } catch (e) {
      if (!keepIdempotencyKey(e)) attempt.current = null;
      setFailure(formError(e).message);
      setBusy(false);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={chat}>Back to the chat</Back>
      <h1 className={vendor.title}>{name ? `Offer for ${name}` : "Send an offer"}</h1>
      <p className={vendor.muted}>
        {`Write exactly what you’ll deliver. ${name || "They"} can pay for it in the chat for ${plural(rules.quoteDays, "day")}, and the work starts once they pay.`}
      </p>
      <form
        className={vendor.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input label="Title" value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={80} placeholder="Like “Logo and 3 social posts”" error={err("title")} />
        <TextArea
          label="What’s included"
          value={draft.description}
          onChange={(v) => set("description", v)}
          max={1200}
          placeholder="What you’ll make, the files they get, what you need from them"
          error={err("description")}
        />
        <KeyedSelect label="Category" value={draft.category} options={rules.categories} onChange={(v) => set("category", v)} error={err("category")} />
        <Input
          label="Price (₹)"
          inputMode="decimal"
          value={draft.price}
          onChange={(e) => set("price", rupeeInput(e.target.value))}
          hint={priceRangeText(rules.minPrice, rules.maxPrice)}
          error={err("price")}
        />
        <div className={vendor.pair} data-even>
          <Input
            label="Days to deliver"
            inputMode="numeric"
            value={draft.deliveryDays}
            onChange={(e) => set("deliveryDays", e.target.value.replace(/\D/g, ""))}
            maxLength={3}
            error={err("deliveryDays")}
          />
          <Input label="Revisions" inputMode="numeric" value={draft.revisions} onChange={(e) => set("revisions", e.target.value.replace(/\D/g, ""))} maxLength={2} error={err("revisions")} />
        </div>
        <p className={vendor.faint}>
          {`Days count from when they pay. Ruxstar keeps ${percentText(rules.commissionBps)} of the price.${rules.platformFee ? ` They also pay a ${money(rules.platformFee)} platform fee.` : ""}`}
        </p>
        {failure && (
          <p className={vendor.error} role="alert">
            {failure}
          </p>
        )}
        <div className={vendor.actions}>
          <Button type="submit" size="lg" loading={busy}>
            Send offer
          </Button>
        </div>
      </form>
    </div>
  );
}

/** A verified freelancer's custom offer, sent into a 1:1 chat (`chatId`), to `name`. */
export function SendOfferScreen({ chatId, name }: { chatId: string | null; name: string }) {
  const { data, error, reload } = useFreelancing("offer");
  if (!chatId) {
    return (
      <Empty title="Open a chat first">
        <p>Offers are sent from a 1:1 chat with the customer.</p>
        <ButtonLink href="/messages" variant="secondary">
          Your messages
        </ButtonLink>
      </Empty>
    );
  }
  if (data?.me) return <Form rules={data.rules} me={data.me} chatId={chatId} name={name} />;
  if (data) {
    return (
      <Empty title="Start freelancing first">
        <p>Offers come from your freelancer profile.</p>
        <ButtonLink href="/freelance" variant="secondary">
          Freelancing
        </ButtonLink>
      </Empty>
    );
  }
  if (error) return <Failed error={error} onRetry={reload} />;
  return <Loading rows={4} />;
}
