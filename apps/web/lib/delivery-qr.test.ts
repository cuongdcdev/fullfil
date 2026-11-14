import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { deliveryQrFileName, deliveryQrPayload, isDeliveryCode } from "./delivery-qr";

const secret = "ab".repeat(32);

describe("delivery QR", () => {
  it("encodes the raw secret and decodes to what the /earn scanner accepts", () => {
    const qr = QRCode.create(deliveryQrPayload(secret), { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    const scale = 8, margin = 4 * scale, dim = size * scale + margin * 2;
    const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) {
      const mx = Math.floor((x - margin) / scale), my = Math.floor((y - margin) / scale);
      if (mx >= 0 && my >= 0 && mx < size && my < size && qr.modules.get(mx, my)) {
        const i = (y * dim + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
    const decoded = jsQR(data, dim, dim);
    expect(decoded?.data).toBe(secret);
    expect(isDeliveryCode(decoded!.data)).toBe(true);
  });
  it("rejects malformed codes and builds a safe file name", () => {
    expect(() => deliveryQrPayload("nope")).toThrow();
    expect(deliveryQrFileName("FUL-ab12")).toBe("fulfil-FUL-ab12-delivery-qr.png");
  });
});
