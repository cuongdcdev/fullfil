"use client";

import { VietQrMark } from "@/components/ui/vietqr-mark";
import { Camera, ImageUp, QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/kit";
import { ErrorBox, StepLabel } from "./common";

export function ScanStep({ onPayload }: { onPayload: (payload: string) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controls = useRef<{ stop: () => void } | null>(null);
  useEffect(() => () => controls.current?.stop(), []);

  const sample = async () => {
    setBusy(true);
    setError("");
    try {
      const s = await api.qrSamples();
      if (!s.pho) throw new Error("No sample QR available.");
      onPayload(s.pho.payload);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  const startCamera = async () => {
    setError("");
    setCamera(true);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      await new Promise((r) => setTimeout(r, 0));
      if (!videoRef.current) throw new Error("Camera view is unavailable.");
      controls.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (result) {
          controls.current?.stop();
          controls.current = null;
          setCamera(false);
          onPayload(result.getText());
        }
      });
    } catch {
      setCamera(false);
      setError("We could not open the camera. Upload a photo or try the sample QR.");
    }
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const url = URL.createObjectURL(file);
      try {
        const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
        onPayload(result.getText());
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setError("We could not find a QR code in that photo. Try another photo.");
      setBusy(false);
    }
  };

  return (
    <>
      <StepLabel step={1} hint="Point your camera at the shop's bank QR." />
      <VietQrMark width={88} />
      <h1 className="h1-title">Scan the shop&apos;s QR</h1>
      {camera ? (
        <div className="grid gap-3">
          <video ref={videoRef} className="aspect-square w-full rounded-2xl bg-black object-cover" muted playsInline />
          <Button variant="secondary" onClick={() => { controls.current?.stop(); controls.current = null; setCamera(false); }}>
            Stop camera
          </Button>
        </div>
      ) : (
        <Button variant="secondary" full onClick={startCamera} disabled={busy} className="min-h-14 text-lg">
          <Camera size={22} aria-hidden /> Scan with camera
        </Button>
      )}
      {error && <ErrorBox message={error} />}
      <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-panel px-4 py-2 text-sm font-bold">
        <ImageUp size={18} aria-hidden /> Upload a photo
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      <Button full onClick={sample} disabled={busy} className="min-h-14 text-lg">
        <QrCode size={18} aria-hidden /> {busy ? "One moment…" : "Try with a sample QR"}
      </Button>
    </>
  );
}
