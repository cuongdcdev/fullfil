"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/kit";

export function payQrFileName(orderId: string): string {
  return `fulfil-${orderId.replace(/[^A-Za-z0-9_-]/g, "")}-pay-qr.png`;
}

async function renderPng(payload: string, orderId: string, amount: string): Promise<string> {
  const qrUrl = await QRCode.toDataURL(payload, { margin: 2, width: 560 });
  const img = new Image();
  await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("QR failed")); img.src = qrUrl; });
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 740;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 640, 740);
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText(`Fulfil order ${orderId}`, 320, 52);
  ctx.drawImage(img, 40, 70, 560, 560);
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(`${amount} · note ${orderId}`, 320, 676);
  ctx.font = "18px sans-serif";
  ctx.fillText("Scan with your bank app. Pay only once.", 320, 712);
  return canvas.toDataURL("image/png");
}

/** Ready-to-scan VietQR for the "Pay the shop" step, with a Save QR button for same-phone use. */
export function PayQr({ payload, orderId, amountLabel }: { payload: string; orderId: string; amountLabel: string }) {
  const [qr, setQr] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    QRCode.toDataURL(payload, { margin: 2, width: 520 }).then(setQr).catch(() => setQr(""));
  }, [payload]);
  const save = async () => {
    try {
      const link = document.createElement("a");
      link.href = await renderPng(payload, orderId, amountLabel);
      link.download = payQrFileName(orderId);
      link.click();
      setNote("QR saved. Open your bank app and scan it from your gallery.");
    } catch {
      setNote("Could not make the image. Use Pay manually instead.");
    }
  };
  return (
    <div className="grid justify-items-center gap-3 text-center">
      {qr
        ? <img src={qr} alt="Payment QR for the shop" width={260} height={260} className="h-auto w-full max-w-[18rem] rounded-xl bg-white" />
        : <div className="aspect-square w-full max-w-[18rem] animate-pulse rounded-xl bg-soft" />}
      <p className="font-bold">Scan with your bank app (VPBank). Amount and note are filled in.</p>
      <Button full variant="secondary" className="min-h-12" onClick={() => void save()}>Save QR</Button>
      {note && <p role="status" className="text-sm text-muted">{note}</p>}
    </div>
  );
}
