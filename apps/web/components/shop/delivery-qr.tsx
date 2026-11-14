"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/kit";
import { deliveryQrFileName, deliveryQrPayload } from "@/lib/delivery-qr";

const LINE = "Show this to your helper only after you get the item.";

async function renderPng(secret: string, orderId: string): Promise<string> {
  const qrUrl = await QRCode.toDataURL(deliveryQrPayload(secret), { margin: 2, width: 560 });
  const img = new Image();
  await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("QR failed")); img.src = qrUrl; });
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 780;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 640, 780);
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText(`Fulfil order ${orderId}`, 320, 56);
  ctx.drawImage(img, 40, 80, 560, 560);
  ctx.font = "20px sans-serif";
  ctx.fillText(LINE, 320, 690);
  ctx.fillText("Delivery code (private)", 320, 730);
  return canvas.toDataURL("image/png");
}

/** Large scannable QR of the buyer's delivery secret + Download QR (primary) + Copy my code (secondary). */
export function DeliveryQr({ secret, orderId, onSaved }: { secret: string; orderId: string; onSaved?: () => void }) {
  const [qr, setQr] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    QRCode.toDataURL(deliveryQrPayload(secret), { margin: 2, width: 520 }).then(setQr).catch(() => setQr(""));
  }, [secret]);
  const download = async () => {
    try {
      const href = await renderPng(secret, orderId);
      const link = document.createElement("a");
      link.href = href;
      link.download = deliveryQrFileName(orderId);
      link.click();
      setNote("QR saved to your downloads.");
      onSaved?.();
    } catch {
      setNote("Could not make the image. Use Copy my code instead.");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setNote("Code copied.");
      onSaved?.();
    } catch {
      setNote("Copy is blocked here. Use Download QR instead.");
    }
  };
  return (
    <div className="grid justify-items-center gap-3 text-center">
      {qr
        ? <img src={qr} alt="Delivery code QR" width={260} height={260} className="h-auto w-full max-w-[18rem] rounded-xl bg-white" />
        : <div className="aspect-square w-full max-w-[18rem] animate-pulse rounded-xl bg-soft" />}
      <Button full className="min-h-12" onClick={() => void download()}>Download QR</Button>
      <Button full variant="secondary" className="min-h-12" onClick={() => void copy()}>Copy my code</Button>
      {note && <p role="status" className="text-sm text-muted">{note}</p>}
    </div>
  );
}
