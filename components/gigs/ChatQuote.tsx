"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { loadMyFreelancer } from "./use-gigs";
import { formError } from "@/lib/api/account";
import { withdrawQuote, type QuoteCard } from "@/lib/api/gigs";
import { money } from "@/lib/api/shops";
import { daysText, quoteBadge, quoteNote, quoteStatus, revisionsText } from "@/lib/gigs";
import styles from "./gigs.module.css";

/** "Send an offer" above the message box of a 1:1 chat, for a verified freelancer who isn't suspended. */
export function OfferChip({ chatId, peerName }: { chatId: string; peerName: string }) {
  const [can, setCan] = useState(false);
  useEffect(() => {
    let live = true;
    loadMyFreelancer().then(
      (me) => live && setCan(!!me && me.verified && !me.suspended),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  if (!can) return null;
  return (
    <Link href={`/freelance/offer?chat=${chatId}&name=${encodeURIComponent(peerName)}`} className={styles.offerChip} aria-label={`Send ${peerName} a custom offer`}>
      <Icon name="briefcase" size={16} />
      Send an offer
    </Link>
  );
}

/**
 * A custom offer in a chat: what's included, price, days and revisions, its state, and Pay or Withdraw while it's open. Same as the app.
 * `mine` is an offer you sent, so its order opens on your Freelancing desk.
 */
export function ChatQuote({ quote, mine, peerName, onChanged }: { quote: QuoteCard; mine: boolean; peerName: string; onChanged: (quote: QuoteCard) => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const now = Date.now();
  const status = quoteStatus(quote, now);
  const badge = quoteBadge(quote, now);
  const open = status === "open";

  const withdraw = async () => {
    setBusy(true);
    setFailure(null);
    try {
      onChanged(await withdrawQuote(quote.id));
      setAsking(false);
    } catch (err) {
      setFailure(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={styles.quote} aria-label={`Offer from ${quote.freelancer.name}: ${quote.title}, ${money(quote.price)}`}>
      <span className={styles.quoteHead}>
        <span>
          <Icon name="briefcase" size={14} /> Custom offer
        </span>
        <Tag tone={badge.tone}>{badge.label}</Tag>
      </span>
      <strong>{quote.title}</strong>
      <span className={styles.quoteText}>{quote.description}</span>
      <span className={styles.quotePrice}>{money(quote.price)}</span>
      <span className={styles.quoteText}>{`${daysText(quote.deliveryDays)} delivery · ${revisionsText(quote.revisions)}`}</span>
      <span className={styles.quoteText}>{quoteNote(quote, now)}</span>
      {asking ? (
        <>
          <span className={styles.quoteText}>{failure ?? `Withdraw this offer? ${peerName} can’t pay for it once it’s withdrawn. You can send a new one.`}</span>
          <span className={styles.quoteActions}>
            <Button variant="danger" loading={busy} onClick={() => void withdraw()}>
              Withdraw
            </Button>
            <Button
             
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setAsking(false);
                setFailure(null);
              }}
            >
              Not now
            </Button>
          </span>
        </>
      ) : (
        <span className={styles.quoteActions}>
          {open && quote.canPay && (
            <ButtonLink href={`/gigs/offers/${quote.id}`}>
              Pay for this offer
            </ButtonLink>
          )}
          {open && quote.canWithdraw && (
            <Button variant="secondary" onClick={() => setAsking(true)}>
              Withdraw offer
            </Button>
          )}
          {status === "paid" && quote.orderId && (
            <ButtonLink variant="secondary" href={mine ? `/freelance/orders/${quote.orderId}` : `/orders/freelance/${quote.orderId}`}>
              Open the order
            </ButtonLink>
          )}
        </span>
      )}
    </span>
  );
}
