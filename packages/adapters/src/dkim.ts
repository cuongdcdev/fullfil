import { createHash, createPublicKey, createSign, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ErrandSpec } from "@fulfil/core";

const fixtureRoot = resolve(
  process.cwd(),
  process.cwd().endsWith("/apps/web") ? "../../fixtures" : "fixtures",
);

/**
 * Fixture "DNS" resolver: maps `selector._domainkey.domain` to a bundled test
 * public key. A production build would replace this with real DNS TXT lookups.
 */
const fixtureDns: Record<string, string> = {
  "test._domainkey.tickets.fulfil-demo.test": "dkim-public.txt",
  "lotus1._domainkey.alerts.lotusbank.example": "dkim-lotusbank-public.txt",
};
export function resolveDkimKey(domain: string, selector: string) {
  const file = fixtureDns[`${selector}._domainkey.${domain}`];
  if (!file) return undefined;
  const record = readFileSync(resolve(fixtureRoot, file), "utf8").trim();
  const p = record.match(/(?:^|;)\s*p=([^;]+)/)?.[1];
  if (!p) return undefined;
  return createPublicKey({
    key: Buffer.from(p, "base64"),
    format: "der",
    type: "spki",
  });
}

export type DkimResult = {
  valid: boolean;
  domain: string;
  body: string;
  reason: string;
};

/** Signature and body-hash verification only. Domain allowlisting is a separate policy check. */
export function verifyDkimSignature(eml: Buffer): DkimResult {
  const raw = eml.toString("utf8");
  const separator = raw.indexOf("\r\n\r\n");
  if (separator < 0)
    return { valid: false, domain: "", body: "", reason: "Malformed email" };
  const headers = raw.slice(0, separator).split("\r\n");
  const body = raw.slice(separator + 4);
  const dkim = headers.find((line) => /^DKIM-Signature:/i.test(line));
  if (!dkim)
    return { valid: false, domain: "", body, reason: "DKIM signature missing" };
  const field = (name: string) =>
    dkim.match(new RegExp(`(?:^|;)\\s*${name}=([^;]*)`, "i"))?.[1]?.trim() ||
    "";
  const domain = field("d"),
    selector = field("s"),
    signature = field("b"),
    bh = field("bh"),
    algorithm = field("a"),
    canonicalization = field("c");
  if (algorithm !== "rsa-sha256" || canonicalization !== "simple/simple")
    return {
      valid: false,
      domain,
      body,
      reason: "Unsupported DKIM algorithm or selector",
    };
  const publicKey = resolveDkimKey(domain, selector);
  if (!publicKey)
    return {
      valid: false,
      domain,
      body,
      reason: "No DKIM key published for this domain and selector",
    };
  if (createHash("sha256").update(body).digest("base64") !== bh)
    return { valid: false, domain, body, reason: "DKIM body hash mismatch" };
  const signedHeaders = headers.filter((line) =>
    /^(From|To|Subject|Date):/i.test(line),
  );
  const input =
    signedHeaders.join("\r\n") + `\r\n${dkim.replace(/\bb=[^;]*/, "b=")}`;
  let valid = false;
  try {
    valid = createVerify("RSA-SHA256")
      .update(input)
      .verify(publicKey, signature, "base64");
  } catch {
    valid = false;
  }
  return {
    valid,
    domain,
    body,
    reason: valid
      ? "DKIM signature verified against bundled test key"
      : "DKIM signature invalid",
  };
}

export function verifyDkimEmail(
  eml: Buffer,
  allowedDomains: string[],
): DkimResult {
  const result = verifyDkimSignature(eml);
  if (result.domain && !allowedDomains.includes(result.domain))
    return {
      ...result,
      valid: false,
      reason: "Signing domain not allowlisted",
    };
  return result;
}

/** Signs a message with a fixture private key (mock/test only). */
export function signFixtureEmail(input: {
  privateKeyFile: string;
  domain: string;
  selector: string;
  headers: string[];
  body: string;
}): Buffer {
  const privateKey = readFileSync(
    resolve(fixtureRoot, input.privateKeyFile),
    "utf8",
  );
  const bh = createHash("sha256").update(input.body).digest("base64");
  const dkimBase = `v=1; a=rsa-sha256; c=simple/simple; d=${input.domain}; s=${input.selector}; h=from:to:subject:date; bh=${bh}; b=`;
  const signature = createSign("RSA-SHA256")
    .update(input.headers.join("\r\n") + `\r\nDKIM-Signature: ${dkimBase}`)
    .sign(privateKey, "base64");
  return Buffer.from(
    `DKIM-Signature: ${dkimBase}${signature}\r\n${input.headers.join("\r\n")}\r\n\r\n${input.body}`,
  );
}

export function signedSampleEmail(spec: ErrandSpec, orderId: string): Buffer {
  return signFixtureEmail({
    privateKeyFile: "dkim-test-private.pem",
    domain: "tickets.fulfil-demo.test",
    selector: "test",
    headers: [
      "From: Fulfil Demo Tickets <tickets@tickets.fulfil-demo.test>",
      "To: agent-alpha.testnet",
      "Subject: Ferry ticket confirmation",
      "Date: Thu, 29 Oct 2026 10:00:00 +0000",
    ],
    body: `Order ID: BOOK-${orderId}\r\nDate: ${spec.date}\r\nQuantity: ${spec.qty}\r\nNames: ${spec.names.join(", ")}\r\nItem: ${spec.item}\r\n`,
  });
}
