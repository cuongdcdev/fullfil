import { createHash, randomBytes } from "node:crypto";

export type DeliveryType = "by_phone" | "by_email";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("Canonical JSON requires integer numbers");
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new Error("Unsupported canonical JSON value");
}

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function specHash(spec: unknown): string {
  return sha256Hex(typeof spec === "string" ? spec : canonicalJson(spec));
}

export function normalizeBeneficiary(value: string, type: DeliveryType): string {
  if (type === "by_phone") {
    const phone = value.replace(/^[\x09-\x0D\x20]+|[\x09-\x0D\x20]+$/g, "");
    if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) throw new Error("Beneficiary must be an E.164 phone number");
    return phone;
  }
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Invalid beneficiary email");
  }
  return email;
}

export function bankTransferSpec(amountVnd: number | string, merchantHash: string) {
  const amount = String(amountVnd);
  if (!/^[1-9]\d*$/.test(amount) || !/^[a-f0-9]{64}$/.test(merchantHash)) {
    throw new Error("Invalid bank transfer spec");
  }
  return { amount, bank: "vpbank", country: "VN", currency: "VND", merchant_hash: merchantHash, v: 1 };
}

const utf8 = new TextEncoder();

/** Trim, turn any run of whitespace/control characters into one space. */
export function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\s\x00-\x1f\x7f]+/g, " ").trim() : "";
}

/** Normalizes, then rejects only empty or too-long text, with a friendly message. */
export function plainText(value: unknown, label: string, maxBytes: number): string {
  const text = normalizeText(value);
  const name = label.charAt(0).toUpperCase() + label.slice(1);
  if (!text) throw new Error(`${name} is required`);
  if (utf8.encode(text).length > maxBytes) {
    const accents = [...text].length <= maxBytes ? " (accented letters count extra)" : "";
    throw new Error(`${name} is too long, keep it under ${maxBytes} characters${accents}`);
  }
  return text;
}

/** Price uses USDC base units (six decimals). The meetup address stays off-chain. */
export function inPersonSpec(input: {
  area: string;
  delivery_hash: string;
  item_desc: string;
  price: string;
}) {
  const area = plainText(input.area, "area", 80);
  const itemDesc = plainText(input.item_desc, "item description", 160);
  if (typeof input.delivery_hash !== "string" || !/^[a-f0-9]{64}$/.test(input.delivery_hash)) {
    throw new Error("Invalid delivery hash");
  }
  if (typeof input.price !== "string" || !/^[1-9]\d*$/.test(input.price) ||
    BigInt(input.price) < BigInt(1_000_000) || BigInt(input.price) > BigInt(20_000_000)) {
    throw new Error("Invalid item price");
  }
  return { area, delivery_hash: input.delivery_hash, item_desc: itemDesc, price: input.price, v: 1 };
}

/** NEAR named and 64-hex implicit account IDs use the same account-id grammar. */
export function isNearAccountId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 2 && value.length <= 64 &&
    /^[a-z0-9]+(?:[-_][a-z0-9]+)*(?:\.[a-z0-9]+(?:[-_][a-z0-9]+)*)*$/.test(value);
}

/** amount_out is the guaranteed NEP-141 amount in token base units. */
export function tokenBuySpec(input: {
  amount_out: string;
  receiver: string;
  token_contract: string;
}) {
  if (typeof input.amount_out !== "string" || input.amount_out.length > 39 || !/^[1-9]\d*$/.test(input.amount_out) ||
    BigInt(input.amount_out) > BigInt("340282366920938463463374607431768211455")) {
    throw new Error("Invalid amount_out");
  }
  if (!isNearAccountId(input.receiver)) throw new Error("Invalid receiver");
  if (!isNearAccountId(input.token_contract)) throw new Error("Invalid token_contract");
  return { amount_out: input.amount_out, receiver: input.receiver, token_contract: input.token_contract, v: 1 };
}

export function cryptorefillsSpec(input: {
  beneficiary: string;
  brand_name: string;
  country: string;
  delivery_type: DeliveryType;
  denomination?: string;
  product_value?: string;
  salt?: string;
}) {
  const beneficiary = normalizeBeneficiary(input.beneficiary, input.delivery_type);
  const salt = input.salt ?? randomBytes(16).toString("hex");
  if (!/^[a-f0-9]{32}$/.test(salt)) throw new Error("Invalid beneficiary salt");
  const denomination = input.denomination ?? "";
  const productValue = input.product_value ?? "";
  if (!!denomination === !!productValue || (productValue && !/^\d+(?:\.\d+)?$/.test(productValue))) {
    throw new Error("Choose denomination or product value");
  }
  return {
    beneficiary_hash: sha256Hex(`${salt}:${beneficiary}`),
    brand_name: input.brand_name,
    country: input.country,
    delivery_type: input.delivery_type,
    denomination,
    product_value: productValue,
    salt,
    v: 1,
  };
}
