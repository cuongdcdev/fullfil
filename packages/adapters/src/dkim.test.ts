import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  renderPdfFirstPage,
  signedSampleEmail,
  verifyDkimEmail,
} from "./index";

const domain = "tickets.fulfil-demo.test";
const fixture = readFileSync(resolve(process.cwd(), "fixtures/sample.eml"));
describe("test DKIM fixture", () => {
  it("verifies the signed email", () =>
    expect(verifyDkimEmail(fixture, [domain]).valid).toBe(true));
  it("rejects body tampering", () =>
    expect(
      verifyDkimEmail(
        Buffer.from(fixture.toString().replace("2026-11-07", "2026-11-08")),
        [domain],
      ).valid,
    ).toBe(false));
  it("rejects an untrusted signing domain", () =>
    expect(verifyDkimEmail(fixture, ["elsewhere.test"]).valid).toBe(false));
  it("generates unique signed booking references", () => {
    const spec = {
      category: "e_ticket" as const,
      item: "Ferry",
      date: "2026-11-07",
      qty: 2,
      names: ["Alice Nguyen", "Bob Tran"],
      maxCostUsd: 40,
      cancellable: false,
      allowedSenderDomains: [domain],
      evidenceClasses: ["dkim_email" as const, "ticket_pdf" as const],
    };
    const first = signedSampleEmail(spec, "a");
    const second = signedSampleEmail(spec, "b");
    expect(verifyDkimEmail(first, [domain]).valid).toBe(true);
    expect(first.toString()).not.toBe(second.toString());
  });
});
it("renders the first PDF page to a real PNG for vision", async () => {
  const pdf = readFileSync(resolve(process.cwd(), "fixtures/ticket.pdf"));
  const image = Buffer.from(await renderPdfFirstPage(pdf), "base64");
  expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
});
