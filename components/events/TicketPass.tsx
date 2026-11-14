"use client";

import { useRef, useState } from "react";
import { Button, Icon, Tag } from "@/components/ui";
import { QrCode } from "@/components/kyc/QrCode";
import type { TicketView } from "@/lib/api/events";
import { dayText, TICKET_STATUS, timeText } from "@/lib/events";
import order from "@/components/shop/order.module.css";
import styles from "./events.module.css";

const SIDE = 720;

/** The QR with the holder's name and code under it, as a PNG someone can show from their own phone. */
async function passPicture(svg: SVGSVGElement, name: string, code: string): Promise<Blob | null> {
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = SIDE;
    canvas.height = SIDE + 150;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, SIDE, SIDE);
    ctx.fillStyle = "#0D0C12";
    ctx.textAlign = "center";
    ctx.font = "600 40px system-ui, sans-serif";
    ctx.fillText(name.length > 28 ? `${name.slice(0, 27)}…` : name, SIDE / 2, SIDE + 40);
    ctx.font = "700 56px system-ui, sans-serif";
    ctx.fillText(code.split("").join(" "), SIDE / 2, SIDE + 115);
    return await new Promise((done) => canvas.toBlob(done, "image/png"));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * One person's ticket: their QR code and six letters, big enough to scan off a screen at the gate. Share sends the
 * QR as a picture where the browser can; otherwise it downloads, so whoever it's for can show it from their phone.
 */
export function TicketPass({ ticket, title, startsAt, index, total }: { ticket: TicketView; title: string; startsAt: string; index: number; total: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const status = TICKET_STATUS[ticket.status];
  const fileName = `ticket-${ticket.code}.png`;
  const message = `${ticket.name}'s ticket for ${title}, ${dayText(startsAt)} at ${timeText(startsAt)}. Show this QR at the gate, or the code ${ticket.code}.`;

  const picture = async () => {
    const svg = box.current?.querySelector("svg");
    return svg ? passPicture(svg, ticket.name, ticket.code) : null;
  };

  const share = async () => {
    setBusy(true);
    try {
      const blob = await picture();
      const file = blob ? new File([blob], fileName, { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: message, title });
      else if (typeof navigator.share === "function") await navigator.share({ text: message, title });
      else if (blob) download(blob, fileName);
    } catch {
      // Closing the share sheet rejects; there is nothing to tell them.
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    const blob = await picture();
    if (blob) download(blob, fileName);
    setBusy(false);
  };

  return (
    <article className={styles.pass} aria-label={`Ticket ${index + 1} of ${total}, ${ticket.name}`}>
      <span className={order.faint}>{`Ticket ${index + 1} of ${total}`}</span>
      <h3 className={styles.passName}>{ticket.name}</h3>
      <span className={order.small}>{ticket.team ? `${ticket.tier} · ${ticket.team}` : ticket.tier}</span>
      <Tag tone={ticket.checkedInAt ? "solid" : status.tone}>{ticket.checkedInAt ? "Checked in" : status.label}</Tag>
      {ticket.qr ? (
        <div className={styles.qr} ref={box}>
          <QrCode value={ticket.qr} size={224} label={`QR code for ${ticket.name}'s ticket`} />
        </div>
      ) : (
        <div className={styles.noQr}>{ticket.status === "cancelled" ? "This ticket was cancelled." : "The QR code shows once it’s paid."}</div>
      )}
      <span className={order.faint}>Code</span>
      <span className={styles.code}>{ticket.code}</span>
      {ticket.qr && (
        <div className={order.actions}>
          <Button variant="secondary" icon={<Icon name="share" size={16} />} loading={busy} onClick={() => void share()} aria-label={`Share ${ticket.name}'s ticket`}>
            Share this ticket
          </Button>
          <Button variant="ghost" icon={<Icon name="download" size={16} />} disabled={busy} onClick={() => void save()} aria-label={`Download ${ticket.name}'s ticket`}>
            Download
          </Button>
        </div>
      )}
    </article>
  );
}
