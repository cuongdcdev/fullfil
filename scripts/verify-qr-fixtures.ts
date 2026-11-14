import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import jsQR from "jsqr";
import { sampleQr } from "../packages/core/src/qr";
import { samplePhoQr } from "../packages/core/src/qrbounty";

for (const rail of ["vietqr", "promptpay"] as const) {
  const svg = readFileSync(resolve(process.cwd(), "fixtures", `${rail}.svg`));
  const image = await loadImage(svg);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height);
  const decoded = jsQR(pixels.data, image.width, image.height);
  assert.equal(
    decoded?.data,
    sampleQr(rail),
    `${rail} SVG must scan to its CRC-valid payload`,
  );
}

{
  const image = await loadImage(readFileSync(resolve(process.cwd(), "fixtures", "vietqr-pho.svg")));
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height);
  assert.equal(
    jsQR(pixels.data, image.width, image.height)?.data,
    samplePhoQr(50_000),
    "pho VietQR SVG must scan to its CRC-valid payload",
  );
}

process.stdout.write(
  "Both fictional QR SVG fixtures decode to their EMVCo payloads\n",
);
