import { afterEach, describe, expect, it } from "vitest";
import { recoverMessageAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  BUYER_STEPS,
  COINS,
  coinName,
  coinsFromTokens,
  roughUsd,
  searchCoins,
  safeCoins,
  addressOk,
  USDC_TOKEN,
  V3Error,
  base64ToBytes,
  buyerPhase,
  bytesToBase64,
  claimedAtMs,
  decimalFromUnits,
  dollarCoins,
  earnedUnits,
  estimatePayUnits,
  formatUsd,
  friendlyError,
  orderTotal,
  setFetch,
  shortAccount,
  topupPhase,
  unitsFromDecimal,
  usdcBalance,
  v3,
  type V3Order,
} from "./v3-client";
import { evmSigner } from "./wallet/evm";
import { readShopQr, crc16 } from "./qr-lite";
import { sampleBankEml } from "./sample-eml";
import { precheckEml } from "./eml-precheck";

afterEach(() => setFetch(undefined));

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("http client", () => {
  it("calls /api/v3 with JSON and same-origin cookies", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    setFetch((async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return reply(200, { orders: [] });
    }) as unknown as typeof fetch);
    await v3.orders({ account: "a.near", limit: 5 });
    expect(seen[0].url).toBe("/api/v3/orders?account=a.near&limit=5");
    expect(seen[0].init.credentials).toBe("same-origin");
    await v3.prepareOrder({ qr_payload: "x", reward_usdc: "3" });
    expect(seen[1].url).toBe("/api/v3/orders/prepare");
    expect(seen[1].init.method).toBe("POST");
    expect(JSON.parse(String(seen[1].init.body))).toEqual({ qr_payload: "x", reward_usdc: "3" });
  });

  it("builds auth_call bodies and uploads raw proof bytes", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    setFetch((async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return reply(200, {});
    }) as unknown as typeof fetch);
    await v3.buildAuthCall({ op: "rate", order_id: "FUL-1", stars: 5 });
    expect(JSON.parse(String(seen[0].init.body))).toEqual({ kind: "auth_call", op: "rate", order_id: "FUL-1", stars: 5 });
    const bytes = new Uint8Array([1, 2, 3]);
    await v3.uploadProof("FUL-1", bytes);
    expect(seen[1].url).toBe("/api/v3/proofs?order_id=FUL-1");
    expect(seen[1].init.body).toBe(bytes);
    expect(seen[1].init.headers).toBeUndefined();
  });

  it("turns API errors into V3Error", async () => {
    setFetch((async () => reply(409, { error: { code: "conflict", message: "Order cannot be claimed" } })) as unknown as typeof fetch);
    const e = await v3.me().catch((x) => x);
    expect(e).toBeInstanceOf(V3Error);
    expect(e).toMatchObject({ code: "conflict", status: 409, message: "Order cannot be claimed" });
    setFetch((async () => new Response("oops", { status: 500 })) as unknown as typeof fetch);
    expect(await v3.me().catch((x) => x)).toMatchObject({ code: "http_error", status: 500 });
  });

  it("friendlyError speaks plainly", () => {
    expect(friendlyError(new V3Error("unauthorized", "Wallet session required", 401))).toBe("Please log in again.");
    expect(friendlyError(new V3Error("invalid_request", "Insufficient intents balance", 400))).toMatch(/Add money/);
    expect(friendlyError(new Error("boom"))).toBe("boom");
    expect(friendlyError(new V3Error("upstream_error", "NEAR RPC query failed: {...}", 502))).toBe(
      "The network didn't accept this. Try again in a minute.",
    );
    expect(friendlyError(new V3Error("http_error", "Request failed (502)", 502))).toMatch(/Try again in a minute/);
    expect(friendlyError(new V3Error("intents_key_missing", "x", 400, "ed25519:k"))).toMatch(/NEAR Intents/);
  });
});

describe("money helpers", () => {
  it("converts decimals to base units and back", () => {
    expect(unitsFromDecimal("12.4")).toBe("12400000");
    expect(unitsFromDecimal("3")).toBe("3000000");
    expect(unitsFromDecimal("0,5")).toBe("500000");
    expect(unitsFromDecimal("1.1234567")).toBeUndefined();
    expect(unitsFromDecimal("-1")).toBeUndefined();
    expect(unitsFromDecimal("abc")).toBeUndefined();
    expect(unitsFromDecimal("0.001", 18)).toBe("1000000000000000");
    expect(decimalFromUnits("12400000")).toBe("12.4");
    expect(decimalFromUnits("3000000")).toBe("3");
    expect(decimalFromUnits("1", 6)).toBe("0.000001");
  });

  it("formats dollars rounded to cents", () => {
    expect(formatUsd("12400000")).toBe("$12.40");
    expect(formatUsd("4970000")).toBe("$4.97");
    expect(formatUsd("0")).toBe("$0.00");
    expect(formatUsd(undefined)).toBe("$0.00");
    expect(formatUsd("1995000")).toBe("$2.00");
    expect(formatUsd("100000000")).toBe("$100.00");
    expect(formatUsd("1234567890")).toBe("$1,234.57");
  });

  it("reads the balance and the total", () => {
    expect(usdcBalance({ intents_balances: { [USDC_TOKEN]: "5" } })).toBe("5");
    expect(usdcBalance(undefined)).toBe("0");
    expect(orderTotal({ pay_amount: "1970000", reward: "3000000" })).toBe("4970000");
  });

  it("rounds the pay amount up like the server", () => {
    expect(estimatePayUnits(50_000, 25_400)).toBe("1968504");
    expect(estimatePayUnits(25_400, 25_400)).toBe("1000000");
    expect(estimatePayUnits(0, 25_400)).toBe("0");
  });
});

describe("accounts and bytes", () => {
  it("shortens accounts", () => {
    expect(shortAccount("0x1234567890abcdef1234567890abcdef123456ab")).toBe("0x12…ab");
    expect(shortAccount("kent-user1.near")).toBe("kent-user1.near");
    expect(shortAccount("a".repeat(64))).toBe("aaaa…aaaa");
    expect(shortAccount(undefined)).toBe("");
  });
  it("round-trips base64", () => {
    const bytes = new Uint8Array(32).map((_, i) => i * 7);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe("orders", () => {
  const base: V3Order = {
    id: "FUL-AAAA",
    buyer: "b",
    token: USDC_TOKEN,
    pay_amount: "1970000",
    reward: "3000000",
    amount_vnd: 50_000,
    merchant_hash: "h",
    deadline_ns: "1",
    status: "funded",
  };
  it("maps status to plain words", () => {
    expect(BUYER_STEPS).toHaveLength(4);
    expect(buyerPhase("funded")).toMatchObject({ step: 1, done: false, terminal: false });
    expect(buyerPhase("claimed").step).toBe(2);
    expect(buyerPhase("sent").step).toBe(3);
    expect(buyerPhase("paid")).toMatchObject({ step: 4, done: true, terminal: true });
    expect(buyerPhase("cancelled")).toMatchObject({ done: false, terminal: true });
    expect(buyerPhase("disputed").terminal).toBe(false);
  });
  it("reads claimed time in both formats", () => {
    expect(claimedAtMs({ claimed_at: "2026-11-07T01:00:00.000Z" })).toBe(Date.parse("2026-11-07T01:00:00.000Z"));
    expect(claimedAtMs({ claimed_at_ns: "1762477200000000000" })).toBe(1762477200000);
    expect(claimedAtMs({})).toBeUndefined();
  });
  it("adds up what a local earned", () => {
    const orders: V3Order[] = [
      { ...base, id: "1", fulfiller: "me", status: "paid" },
      { ...base, id: "2", fulfiller: "me", status: "resolved", verdict: "buyer" },
      { ...base, id: "3", fulfiller: "me", status: "claimed" },
      { ...base, id: "4", fulfiller: "other", status: "paid" },
    ];
    expect(earnedUnits(orders, "me")).toBe(BigInt(4_970_000));
  });
});

describe("coins and top-up", () => {
  it("offers the main coins and only dollars in mock", () => {
    expect(COINS.map((c) => `${c.label}/${c.network}`)).toEqual(
      expect.arrayContaining(["USDC/Base", "USDC/Arbitrum", "USDC/Ethereum", "USDC/NEAR", "ETH/Ethereum", "NEAR/NEAR"]),
    );
    expect(dollarCoins().every((c) => c.label === "USDC")).toBe(true);
    expect(COINS.find((c) => c.id === "usdc-near")?.assetId).toBe(USDC_TOKEN);
  });
  it("turns the 1Click token list into coins, featured first", () => {
    const coins = coinsFromTokens([
      { assetId: "nep141:sol.omft.near", symbol: "SOL", blockchain: "sol", decimals: 9, price: 150 },
      { assetId: "nep141:aaa.near", symbol: "AAA", blockchain: "zzz", decimals: 18 },
      { assetId: "nep141:blackdragon.tkn.near", symbol: "BLACKDRAGON", blockchain: "near", decimals: 24, price: 6e-9 },
      { assetId: USDC_TOKEN, symbol: "USDC", blockchain: "near", decimals: 6, price: 1 },
    ]);
    expect(coins.map((c) => `${c.label}/${c.network}`)).toEqual([
      "USDC/NEAR", "SOL/Solana", "BLACKDRAGON/NEAR", "AAA/Zzz",
    ]);
    expect(roughUsd(coins[2], "816000000")).toBeCloseTo(4.896, 3);
    expect(roughUsd(coins[3], "5")).toBeUndefined();
  });
  it("searches coins without picking one, exact symbol first", () => {
    const coins = coinsFromTokens([
      { assetId: "nep141:usdc.near", symbol: "USDC", blockchain: "near", decimals: 6 },
      { assetId: "nep141:base-usdc.omft.near", symbol: "USDC", blockchain: "base", decimals: 6 },
      { assetId: "nep141:base-pit.omft.near", symbol: "SSC1_PIT", blockchain: "base", decimals: 18 },
      { assetId: "nep141:base-usdce.omft.near", symbol: "USDC.e", blockchain: "base", decimals: 6 },
    ]);
    expect(searchCoins(coins, "usdc").map(coinName)).toEqual(["USDC on NEAR", "USDC on Base", "USDC.e on Base"]);
    expect(searchCoins(coins, "base").map((c) => c.label)).toEqual(["USDC", "SSC1_PIT", "USDC.e"]);
    expect(searchCoins(coins, "11")).toEqual([]);
    expect(searchCoins(coins, "  ")).toHaveLength(4);
  });
  it("offers USDC on Solana for withdraw and checks addresses per network", () => {
    expect(COINS.find((c) => c.id === "usdc-sol")?.network).toBe("Solana");
    expect(addressOk("Solana", "7wYoDWG8eeQ9KqiU5eQTXU3rGowimDXah97LeQXjwjeS")).toBe(true);
    expect(addressOk("Solana", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913")).toBe(false);
    expect(addressOk("Base", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913")).toBe(true);
    expect(addressOk("Base", "kent-user1.near")).toBe(false);
    expect(addressOk("NEAR", "kent-user1.near")).toBe(true);
    expect(addressOk("NEAR", "Kent.near")).toBe(false);
    expect(safeCoins(COINS).map(coinName)).toEqual(["USDC on NEAR", "NEAR on NEAR"]);
  });
  it("lists the owner's popular coins first, then the rest by name", () => {
    const t = (symbol: string, blockchain: string) => ({ assetId: `nep141:${symbol}-${blockchain}`, symbol, blockchain, decimals: 6 });
    const coins = coinsFromTokens([
      t("AAA", "near"), t("USDT", "near"), t("SOL", "sol"), t("ZEC", "zec"), t("USDC", "base"),
      t("wNEAR", "near"), t("SHITZU", "near"), t("USDC", "near"),
    ]);
    expect(coins.map(coinName)).toEqual([
      "USDC on NEAR", "SHITZU on NEAR", "NEAR on NEAR", "ZEC on Zcash", "SOL on Solana", "USDT on NEAR",
      "USDC on Base", "AAA on NEAR",
    ]);
  });
  it("classifies 1Click statuses", () => {
    expect(topupPhase(undefined)).toBe("waiting");
    expect(topupPhase("PENDING_DEPOSIT")).toBe("waiting");
    expect(topupPhase("PROCESSING")).toBe("working");
    expect(topupPhase("SUCCESS")).toBe("done");
    expect(topupPhase("REFUNDED")).toBe("failed");
  });
});

describe("shop QR reader", () => {
  const t = (id: string, v: string) => `${id}${String(v.length).padStart(2, "0")}${v}`;
  const make = (amount?: number) => {
    const raw =
      "000201" +
      t("01", "12") +
      t("38", t("00", "A000000727") + t("01", t("00", "999704") + t("01", "0987654321")) + t("02", "QRIBFTTA")) +
      t("53", "704") +
      (amount ? t("54", String(amount)) : "") +
      t("58", "VN") +
      t("59", "PHO BAY SAO DEMO") +
      "6304";
    return raw + crc16(raw);
  };
  it("reads name, bank and amount", () => {
    expect(readShopQr(make(50_000))).toEqual({
      name: "PHO BAY SAO DEMO",
      bankBin: "999704",
      accountMasked: "•••• 4321",
      amountVnd: 50_000,
    });
    expect(readShopQr(make()).amountVnd).toBeUndefined();
  });
  it("rejects damaged codes in plain words", () => {
    expect(() => readShopQr(make(1000).replace("PHO", "XHO"))).toThrow(/damaged/);
    expect(() => readShopQr("hello")).toThrow();
  });
});

describe("wallet signers", () => {
  it("signs the login challenge and intents with ERC-191", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const signer = evmSigner("demo", account.address, (message) => account.signMessage({ message }));
    const challenge = { nonce: "n", message: "Sign in to Fulfil\nNonce: n", recipient: "localhost", expires_at: "" };
    const login = await signer.signLogin(challenge);
    expect(login).toMatchObject({ standard: "erc191", address: account.address.toLowerCase(), message: challenge.message });
    expect(await recoverMessageAddress({ message: challenge.message, signature: login.signature as `0x${string}` })).toBe(account.address);

    const text = JSON.stringify({ signer_id: account.address.toLowerCase(), intents: [] });
    const signed = await signer.signIntent({ standard: "erc191", payload_to_sign: text, nonce: "n", deadline: "", intents: [] });
    expect(signed).toMatchObject({ standard: "erc191", payload: text });
    expect(await recoverMessageAddress({ message: text, signature: (signed as { signature: `0x${string}` }).signature })).toBe(account.address);
  });
  it("refuses a NEP-413 payload in an ERC-191 wallet", async () => {
    const signer = evmSigner("evm", "0xabc", async () => "0x");
    await expect(
      signer.signIntent({ standard: "nep413", payload_to_sign: { message: "m", nonce: "n", recipient: "r" }, nonce: "n", deadline: "", intents: [] }),
    ).rejects.toThrow();
  });
});

describe("demo bank email", () => {
  it("passes the on-screen checks", () => {
    const now = new Date();
    const eml = sampleBankEml({ code: "FUL-ABCD1234", amountVnd: 50_000, accountLast4: "4321", now });
    const r = precheckEml(new TextEncoder().encode(eml), {
      code: "FUL-ABCD1234",
      amountVnd: 50_000,
      accountLast4: "4321",
      claimedAt: now.getTime() - 1000,
    });
    expect(r.checks.filter((c) => c.ok !== true)).toEqual([]);
    expect(r.ready).toBe(true);
  });
});
