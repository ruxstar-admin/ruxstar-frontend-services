"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { RuxstarCard } from "@/components/kyc/RuxstarCard";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Icon, Input, Skeleton, Tag, useToast, type TagTone } from "@/components/ui";
import { formError } from "@/lib/api/account";
import {
  PAN,
  checkAadhaar,
  checkPan,
  getCard,
  getKyc,
  sendSelfie,
  startAadhaar,
  submitIdentity,
  type BaseCase,
  type CaseStatus,
  type Overview,
  type RuxstarCard as Card,
  type StepStatus,
} from "@/lib/api/kyc";
import { SelfieCapture } from "./selfie";
import styles from "./verify.module.css";

const EDITABLE: CaseStatus[] = ["not_started", "in_progress", "rejected"];

const STEP_TAG: Record<StepStatus, [string, TagTone] | null> = {
  not_started: null,
  pending: ["Waiting", "warning"],
  verified: ["Done", "success"],
  failed: ["Try again", "danger"],
};

function Step({ n, title, status, children, open }: { n: number; title: string; status: StepStatus; open: boolean; children?: ReactNode }) {
  const tag = STEP_TAG[status];
  return (
    <li className={styles.step} data-open={open || undefined} data-done={status === "verified" || undefined}>
      <span className={styles.stepMark} aria-hidden>
        {status === "verified" ? <Icon name="check" size={18} /> : n}
      </span>
      <div className={styles.stepBody}>
        <div className={styles.stepHead}>
          <h3 className={styles.stepTitle}>{title}</h3>
          {tag && <Tag tone={tag[1]}>{tag[0]}</Tag>}
        </div>
        {children}
      </div>
    </li>
  );
}

/** Where a case stands once it has left the person's hands, or come back to them. */
function CaseNote({ c, what }: { c: BaseCase; what: string }) {
  if (c.status === "submitted") {
    return (
      <p className={styles.note} data-tone="info">
        <Icon name="clock" size={20} /> Your {what} is with the Ruxstar team. We will let you know when it is reviewed, usually within a day.
      </p>
    );
  }
  if (c.status === "rejected") {
    return (
      <p className={styles.note} data-tone="danger">
        <Icon name="alert" size={20} />
        <span>
          <strong>Needs a change:</strong> {c.rejectionReason ?? "Check your details and send again."}{" "}
          {c.rejectionsLeft === 1 ? "One more rejection puts this on hold." : null}
        </span>
      </p>
    );
  }
  if (c.status === "locked") {
    return (
      <p className={styles.note} data-tone="danger">
        <Icon name="alert" size={20} /> Verification is on hold after several rejections. Contact Ruxstar support to continue.
      </p>
    );
  }
  return null;
}

export function VerifyScreen() {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [kyc, setKyc] = useState<Overview | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [pan, setPan] = useState("");
  const [panError, setPanError] = useState<string | null>(null);
  const [faceError, setFaceError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getKyc()
      .then((o) => live && setKyc(o))
      .catch((err) => {
        if (live && !onSignedOut(err)) setLoadError(formError(err).message);
      });
    return () => {
      live = false;
    };
  }, [attempt, onSignedOut]);

  const approved = kyc?.base.status === "approved";
  useEffect(() => {
    if (!approved) return;
    getCard().then(setCard, () => undefined);
  }, [approved]);

  /** Runs one action. A failed check still changed the case (tries, reason), so reload it either way. */
  const run = useCallback(
    async (name: string, action: () => Promise<Overview | void>, onError?: (message: string) => void) => {
      setBusy(name);
      try {
        const next = await action();
        if (next) setKyc(next);
      } catch (err) {
        if (onSignedOut(err)) return;
        const { message } = formError(err);
        if (onError) onError(message);
        else toast(message, "danger");
        getKyc().then(setKyc, () => undefined);
      } finally {
        setBusy(null);
      }
    },
    [onSignedOut, toast],
  );

  if (loadError) {
    return (
      <div className={styles.page}>
        <div className={styles.failed} role="alert">
          <p>{loadError}</p>
          <Button variant="secondary" onClick={() => (setLoadError(null), setAttempt((n) => n + 1))}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!kyc) {
    return (
      <div className={styles.page} aria-busy>
        <Skeleton width={220} height={34} />
        <Skeleton height={320} radius={18} />
      </div>
    );
  }

  const { base } = kyc;
  const editable = EDITABLE.includes(base.status);
  const { aadhaar, pan: panStep, face } = base.steps;
  const allDone = aadhaar.status === "verified" && panStep.status === "verified" && face.status === "verified";

  const submitPan = (e: FormEvent) => {
    e.preventDefault();
    const value = pan.trim().toUpperCase();
    if (!PAN.test(value)) return setPanError("A PAN has 10 characters, like ABCDE1234F.");
    setPanError(null);
    void run("pan", () => checkPan(value), setPanError);
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Verification</h1>
        <p className={styles.muted}>Verify once to get your Ruxstar Card, the Verified tick and the vendor portal.</p>
      </header>

      <section className={styles.section} aria-labelledby="identity">
        <div className={styles.sectionHead}>
          <h2 id="identity" className={styles.sectionTitle}>
            <Icon name="shield" size={22} /> Identity
          </h2>
          {approved && <Tag tone="success">Verified</Tag>}
        </div>

        {approved ? (
          card ? (
            <div className={styles.cardWrap}>
              <RuxstarCard card={card} />
              <p className={styles.muted}>Only you can see your masked Aadhaar and PAN. Others see the Verified tick on your profile and posts.</p>
              <p className={styles.note} data-tone="info">
                <Icon name="store" size={20} /> Your vendor portal is open in the Ruxstar app. Add your businesses and set up payments from your profile.
              </p>
            </div>
          ) : (
            <Skeleton height={260} radius={22} />
          )
        ) : (
          <>
            <CaseNote c={base} what="identity verification" />
            <ol className={styles.steps}>
              <Step n={1} title="Aadhaar with DigiLocker" status={aadhaar.status} open={editable && aadhaar.status !== "verified"}>
                {aadhaar.status === "verified" ? (
                  <p className={styles.muted}>
                    {aadhaar.name} · XXXX XXXX {aadhaar.last4}
                  </p>
                ) : aadhaar.status === "pending" ? (
                  <>
                    <p className={styles.muted}>Finish in DigiLocker, then come back here.</p>
                    {editable && (
                      <div className={styles.actions}>
                        <Button variant="ghost" onClick={() => run("aadhaar", async () => window.location.assign(await startAadhaar()))} loading={busy === "aadhaar"}>
                          Start again
                        </Button>
                        <Button variant="secondary" onClick={() => run("check", checkAadhaar)} loading={busy === "check"}>
                          I have finished
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {aadhaar.reason ? (
                      <p className={styles.error}>{aadhaar.reason}</p>
                    ) : (
                      <p className={styles.muted}>Share your Aadhaar from DigiLocker. We keep only your name and the last 4 digits.</p>
                    )}
                    {editable && (
                      <div className={styles.actions}>
                        <Button onClick={() => run("aadhaar", async () => window.location.assign(await startAadhaar()))} loading={busy === "aadhaar"}>
                          Continue with DigiLocker
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </Step>

              <Step n={2} title="PAN" status={panStep.status} open={editable && aadhaar.status === "verified" && panStep.status !== "verified"}>
                {panStep.status === "verified" ? (
                  <p className={styles.muted}>{panStep.masked} · Name matches your Aadhaar</p>
                ) : aadhaar.status !== "verified" ? (
                  <p className={styles.muted}>After Aadhaar. The name on your PAN must match it.</p>
                ) : (
                  editable && (
                    <form className={styles.inline} onSubmit={submitPan} noValidate>
                      <Input
                        label="PAN number"
                        value={pan}
                        onChange={(e) => (setPan(e.target.value.toUpperCase().replace(/\s/g, "")), setPanError(null))}
                        error={panError ?? panStep.reason ?? undefined}
                        maxLength={10}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="ABCDE1234F"
                      />
                      <Button type="submit" loading={busy === "pan"}>
                        Check PAN
                      </Button>
                    </form>
                  )
                )}
              </Step>

              <Step n={3} title="Live selfie" status={face.status} open={editable && panStep.status === "verified" && face.status !== "verified"}>
                {face.status === "verified" ? (
                  <p className={styles.muted}>Matched to your Aadhaar photo</p>
                ) : panStep.status !== "verified" ? (
                  <p className={styles.muted}>After PAN. We match it to your Aadhaar photo.</p>
                ) : (
                  editable && (
                    <>
                      {(faceError ?? face.reason) && <p className={styles.error}>{faceError ?? face.reason}</p>}
                      <SelfieCapture
                        busy={busy === "face"}
                        onUse={(photo) => {
                          setFaceError(null);
                          void run("face", () => sendSelfie(photo), setFaceError);
                        }}
                      />
                    </>
                  )
                )}
              </Step>
            </ol>

            {editable && (
              <div className={styles.submit}>
                <p className={styles.muted}>{allDone ? "All set. Send it to the Ruxstar team for a final check." : "Finish all three steps to send for review."}</p>
                <Button size="lg" disabled={!allDone} loading={busy === "submit"} onClick={() => run("submit", submitIdentity, (m) => toast(m, "danger"))}>
                  Send for review
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
