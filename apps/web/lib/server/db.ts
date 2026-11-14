import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildQrOrderDetail,
  cents,
  parseVietQr,
  requiredBond,
  samplePhoQr,
  sha256,
  tier,
  transition,
  type Fulfiller,
  type OrderDetail,
} from "@fulfil/core";
import { mockSpec } from "@fulfil/adapters";

export const records = sqliteTable("records", {
  key: text("key").primaryKey(),
  kind: text("kind").notNull(),
  value: text("value").notNull(),
});
const dataPath =
  process.env.DATABASE_URL?.replace(/^file:/, "") ||
  resolve(
    process.cwd(),
    process.cwd().endsWith("/apps/web") ? "../../data/dev.db" : "data/dev.db",
  );
mkdirSync(dirname(dataPath), { recursive: true });
const sqlite = new Database(dataPath);
sqlite.pragma("journal_mode = WAL");
sqlite.exec(
  "CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, kind TEXT NOT NULL, value TEXT NOT NULL)",
);
export const db = drizzle(sqlite, { schema: { records } });
export function get<T>(key: string): T | undefined {
  const row = db.select().from(records).where(eq(records.key, key)).get();
  return row ? (JSON.parse(row.value) as T) : undefined;
}
export function put(key: string, kind: string, value: unknown): void {
  db.insert(records)
    .values({ key, kind, value: JSON.stringify(value) })
    .onConflictDoUpdate({
      target: records.key,
      set: { value: JSON.stringify(value), kind },
    })
    .run();
}
export function list<T>(kind: string): T[] {
  return db
    .select()
    .from(records)
    .all()
    .filter((x) => x.kind === kind)
    .map((x) => JSON.parse(x.value) as T);
}
export function listEntries<T>(kind: string): { key: string; value: T }[] {
  return db.select().from(records).all()
    .filter((row) => row.kind === kind)
    .map((row) => ({ key: row.key, value: JSON.parse(row.value) as T }));
}
export function remove(key: string): void {
  db.delete(records).where(eq(records.key, key)).run();
}
export function accountCents(account: string): number {
  return cents(
    get<{ amountUsd: number }>(key("balance", account))?.amountUsd ?? 0,
  );
}
export function setAccountCents(account: string, amountCents: number): void {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0)
    throw new Error("Invalid ledger balance");
  put(key("balance", account), "balance", { amountUsd: amountCents / 100 });
}
export function transferCents(
  from: string,
  to: string,
  amountCents: number,
): void {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0)
    throw new Error("Invalid ledger transfer");
  if (accountCents(from) < amountCents)
    throw new Error(`Insufficient ${from} balance`);
  setAccountCents(from, accountCents(from) - amountCents);
  setAccountCents(to, accountCents(to) + amountCents);
}
export function totalLedgerCents(): number {
  return list<{ amountUsd: number }>("balance").reduce(
    (sum, balance) => sum + cents(balance.amountUsd),
    0,
  );
}
export function atomic<T>(fn: () => T): T {
  return sqlite.transaction(fn)();
}
export const key = (kind: string, id: string) => `${kind}:${id}`;
export const nowIso = () => new Date().toISOString();
export function saveOrder(order: OrderDetail): void {
  put(key("order", order.id), "order", order);
}
export function orderById(id: string): OrderDetail | undefined {
  return get<OrderDetail>(key("order", id));
}
export function orders(): OrderDetail[] {
  return list<OrderDetail>("order").sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
export function fulfillerById(id: string): Fulfiller | undefined {
  return get<Fulfiller>(key("fulfiller", id));
}
export function fulfillers(): Fulfiller[] {
  return list<Fulfiller>("fulfiller");
}
export function saveFulfiller(f: Fulfiller): void {
  put(key("fulfiller", f.accountId), "fulfiller", f);
}
export function transaction(
  order: OrderDetail,
  kind: string,
  amountUsd?: number,
): void {
  order.transactions.push({
    id: `mock-tx-${randomUUID().slice(0, 12)}`,
    kind,
    amountUsd,
    mock: true,
    createdAt: nowIso(),
  });
}
export function seed(): void {
  if (get("meta:seeded")) return;
  const defaults: Omit<Fulfiller, "tier">[] = [
    {
      accountId: "linh.fulfil.testnet",
      displayName: "Example helper",
      city: "Da Nang",
      kinds: ["errand", "qr_payment"],
      bondUsd: 300,
      lockedUsd: 0,
      counters: {
        completed: 31,
        clean: 30,
        disputesLost: 0,
        disputesWon: 1,
        appealsWon: 0,
        volumeUsd: 830,
      },
    },
    {
      accountId: "minh.fulfil.testnet",
      displayName: "Example new helper",
      city: "Hoi An",
      kinds: ["errand", "qr_payment"],
      bondUsd: 60,
      lockedUsd: 0,
      counters: {
        completed: 0,
        clean: 0,
        disputesLost: 0,
        disputesWon: 0,
        appealsWon: 0,
        volumeUsd: 0,
      },
    },
    {
      accountId: "yuki.fulfil.testnet",
      displayName: "Example online helper",
      city: "Osaka",
      kinds: ["errand"],
      bondUsd: 150,
      lockedUsd: 0,
      counters: {
        completed: 7,
        clean: 7,
        disputesLost: 0,
        disputesWon: 0,
        appealsWon: 0,
        volumeUsd: 170,
      },
    },
  ];
  atomic(() => {
    for (const f of defaults) saveFulfiller({ ...f, tier: tier(f.counters) });
    setAccountCents("agent-alpha.testnet", 50_000);
    setAccountCents("court.pool", 0);
    setAccountCents("treasury", 0);
    for (const f of defaults) {
      setAccountCents(f.accountId, 50_000);
      setAccountCents(`bond:${f.accountId}`, cents(f.bondUsd));
    }
    const generated = mockSpec("Get two Cham Islands ferry tickets Saturday", {
      date: "2026-11-07",
      names: ["Example passenger 1", "Example passenger 2"],
    });
    const historical = [
      { id: "hist-released", state: "Released" as const, type: "confirm" },
      { id: "hist-rejected", state: "Refunded" as const, type: "refund" },
      { id: "hist-case", state: "Resolved" as const, type: "verdict" },
    ];
    for (const item of historical) {
      const order: OrderDetail = {
        id: item.id,
        kind: "errand",
        buyer: "agent-alpha.testnet",
        spec: generated.spec,
        rubric: generated.rubric,
        specHash: sha256(generated.spec),
        rubricHash: sha256(generated.rubric),
        state: item.state,
        quoteId: `quote-${item.id}`,
        escrowUsd: 28,
        createdAt: "2026-10-28T09:00:00.000Z",
        history: [
          {
            type: item.type,
            from: "Delivered",
            to: item.state,
            at: "2026-10-28T10:00:00.000Z",
          },
        ],
        quotes: [
          {
            id: `quote-${item.id}`,
            orderId: item.id,
            fulfiller: "linh.fulfil.testnet",
            displayName: "Example helper",
            tier: 2,
            costUsd: 25,
            feeUsd: 3,
            totalUsd: 28,
            etaMinutes: 20,
            validUntil: "2026-10-28T11:00:00.000Z",
            bondLockUsd: 7,
            signature: "mock-historical",
          },
        ],
        bundles: [],
        transactions: [
          {
            id: `mock-tx-${item.id}`,
            kind: item.state === "Refunded" ? "refund" : "escrow",
            amountUsd: 28,
            mock: true,
            createdAt: "2026-10-28T10:00:00.000Z",
          },
        ],
        mock: true,
      };
      if (item.state === "Resolved")
        order.dispute = {
          orderId: item.id,
          reason: "Example: I paid for the tickets, but I have not received them yet.",
          buyerStakeUsd: 2.8,
          injectionFlag: false,
          appealCount: 0,
          layer0: { checks: [{ id: "dkim", pass: true, detail: "Matched" }] },
          sage: { answer: null, probability: 0, model: "mock-sage" },
          court: {
            panelSize: 3,
            votes: Array.from({ length: 3 }, (_, index) => ({
              verdict: "fulfiller",
              reasons: ["Evidence matches locked rubric"],
              citedRubricIds: ["dkim"],
              injectionDetected: false,
              model: `mock-juror-${index + 1}`,
            })),
          },
          outcome: "fulfiller",
        };
      saveOrder(order);
    }
    put("meta:seeded", "meta", { at: nowIso() });
  });
}
seed();
atomic(() => {
  if (!get("balance:agent-alpha.testnet"))
    setAccountCents("agent-alpha.testnet", 50_000);
  if (!get("balance:court.pool")) setAccountCents("court.pool", 0);
  if (!get("balance:treasury")) setAccountCents("treasury", 0);
  for (const fulfiller of fulfillers()) {
    if (!get(key("balance", fulfiller.accountId)))
      setAccountCents(fulfiller.accountId, 50_000);
    if (!get(key("balance", `bond:${fulfiller.accountId}`)))
      setAccountCents(`bond:${fulfiller.accountId}`, cents(fulfiller.bondUsd));
  }
  for (const order of orders()) {
    if (
      ["Funded", "Purchased", "Delivered", "Disputed", "Resolved"].includes(
        order.state,
      ) &&
      order.escrowUsd !== undefined &&
      !get(key("balance", `escrow:${order.id}`))
    ) {
      setAccountCents(`escrow:${order.id}`, cents(order.escrowUsd));
    }
    if (
      ["Disputed", "Resolved"].includes(order.state) &&
      order.dispute &&
      !get(key("balance", `stake:${order.id}`))
    ) {
      setAccountCents(`stake:${order.id}`, cents(order.dispute.buyerStakeUsd));
    }
  }
});

/** QR bounty demo data: locals at Level 0, 2 and 3, plus one finished order for Activity. */
function seedQr(): void {
  if (get("meta:seeded-qr")) return;
  atomic(() => {
    const base = {
      kinds: ["errand", "qr_payment"] as Fulfiller["kinds"],
      lockedUsd: 0,
    };
    const ratings: Record<string, [number, number]> = {
      "linh.fulfil.testnet": [4.9, 31],
      "minh.fulfil.testnet": [4.7, 0],
    };
    for (const [accountId, [rating, ratingCount]] of Object.entries(ratings)) {
      const f = fulfillerById(accountId);
      if (f && f.rating === undefined) saveFulfiller({ ...f, rating, ratingCount });
    }
    if (!fulfillerById("bao.fulfil.testnet")) {
      const counters = {
        completed: 142,
        clean: 140,
        disputesLost: 1,
        disputesWon: 2,
        appealsWon: 2,
        volumeUsd: 3900,
      };
      saveFulfiller({
        ...base,
        accountId: "bao.fulfil.testnet",
        displayName: "Example experienced helper",
        city: "Ho Chi Minh City",
        bondUsd: 400,
        counters,
        tier: tier(counters),
        rating: 4.95,
        ratingCount: 142,
      });
      setAccountCents("bao.fulfil.testnet", 50_000);
      setAccountCents("bond:bao.fulfil.testnet", 40_000);
    }
    if (!orderById("qr-hist-finished")) {
      const linh = fulfillerById("linh.fulfil.testnet")!;
      const at = new Date("2026-11-05T05:20:00.000Z");
      const at2 = (m: number) => new Date(at.getTime() + m * 60_000).toISOString();
      let order = buildQrOrderDetail({
        id: "qr-hist-finished",
        buyer: "agent-alpha.testnet",
        now: at,
        qr: parseVietQr(samplePhoQr(50_000)),
        vnd: 50_000,
        fx: { rate: 25_400, source: "mock" },
        rewardUsd: 3,
        payWith: "USDC",
        transferCode: "FUL-8K2Q",
        mock: true,
      });
      const qr = order.qr!;
      const lock = requiredBond(qr.totalUsd, linh.tier);
      const quote = {
        id: "quote-qr-hist-finished",
        orderId: order.id,
        fulfiller: linh.accountId,
        displayName: linh.displayName,
        tier: linh.tier,
        costUsd: qr.principalUsd,
        feeUsd: qr.rewardUsd,
        totalUsd: qr.totalUsd,
        etaMinutes: 5,
        validUntil: at2(60),
        bondLockUsd: lock,
        signature: "mock-historical",
      };
      for (const [action, minutes] of [
        ["qr_fund", 1],
        ["submit_evidence", 6],
        ["verify_ok", 7],
        ["confirm", 9],
      ] as const)
        order = transition(order, action, new Date(at2(minutes)));
      order.quotes = [quote];
      order.quoteId = quote.id;
      order.fulfiller = linh;
      order.escrowUsd = qr.totalUsd;
      order.transactions.push(
        { id: "mock-tx-qr-hist-escrow", kind: "escrow", amountUsd: qr.totalUsd, mock: true, createdAt: at2(1) },
        { id: "mock-tx-qr-hist-release", kind: "release", amountUsd: qr.totalUsd, mock: true, createdAt: at2(9) },
      );
      qr.funding = { payWith: "USDC", payAmount: qr.totalUsd, intentId: "mock-intent-historical", mock: true, at: at2(1) };
      qr.claimedAt = at2(2);
      qr.sentAt = at2(5);
      qr.ratingGiven = 5;
      const attestation = { provider: "mock" as const, inputHash: sha256("hist-eml"), outputHash: sha256("hist-checks"), verifiedAt: at2(7), note: "Mock secure verifier (not a TEE)." };
      qr.proof = {
        method: "bank_email",
        accepted: true,
        limited: false,
        submittedAt: at2(6),
        bankRef: "LTB202611051225A1B2C3",
        attestation,
        checks: ["dkim_signature", "bank_domain", "amount", "recipient", "transfer_note", "after_claim", "not_reused"].map((id) => ({ id, pass: true, detail: "Passed" })),
      };
      qr.stage = "done";
      qr.timeline.push(
        { stage: "finding_local", at: at2(1), label: "Paid into escrow" },
        { stage: "claimed", at: at2(2), label: "Example helper accepted the job" },
        { stage: "transfer_sent", at: at2(5), label: "Example helper says the transfer was sent" },
        { stage: "awaiting_confirmation", at: at2(7), label: "Bank email verified" },
        { stage: "done", at: at2(9), label: "Requester confirmed the merchant received it" },
      );
      saveOrder(order);
      // Settle the historical order in the ledger: requester pays, local receives.
      transferCents("agent-alpha.testnet", linh.accountId, cents(qr.totalUsd));
    }
    put("meta:seeded-qr", "meta", { at: nowIso() });
  });
}
seedQr();
