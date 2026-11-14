/** The delivery QR encodes the raw 64-hex secret S. The fulfiller scanner on /earn expects exactly that. */
export const DELIVERY_CODE_RE = /^[a-f0-9]{64}$/;

export function isDeliveryCode(text: string): boolean {
  return DELIVERY_CODE_RE.test(text.trim());
}

/** What goes into the QR image. */
export function deliveryQrPayload(secret: string): string {
  const code = secret.trim();
  if (!isDeliveryCode(code)) throw new Error("Delivery code must be 64 lowercase hex characters.");
  return code;
}

export function deliveryQrFileName(orderId: string): string {
  return `fulfil-${orderId.replace(/[^A-Za-z0-9_-]/g, "")}-delivery-qr.png`;
}
