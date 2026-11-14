/**
 * Seeds a believable demo dataset into a MOCK-mode database.
 *
 *   FULFIL_MODE=mock npx tsx scripts/demo/seed-demo.ts            # data/dev.db under the cwd
 *   FULFIL_MODE=mock npx tsx scripts/demo/seed-demo.ts /path/x.db  # explicit db path
 *
 * It deletes and recreates the target db (like scripts/reset.ts), then drives
 * the mock escrow (prepare -> fund -> claim -> proof -> settle) so every record
 * has the real shape. Nothing here signs, sends or touches a network wallet.
 */
import { createHash, randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

if (process.env.FULFIL_MODE !== "mock") {
  console.error("Refusing to run: set FULFIL_MODE=mock.");
  process.exit(1);
}
const target = resolve(process.argv[2] || resolve(process.cwd(), "data/dev.db"));
if (/\/mvp-fulfil\/data\//.test(target)) {
  console.error(`Refusing to wipe ${target}: that is the main checkout's database.`);
  process.exit(1);
}
process.env.DATABASE_URL = `file:${target}`;
process.env.SHOPPER_ACCOUNT_ID = "shopper.mock.near";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${target}${suffix}`, { force: true });

const { MockEscrow } = await import("../../apps/web/lib/server/v3/escrow");
const { get, put } = await import("../../apps/web/lib/server/db");
const { prepareInPerson } = await import("../../apps/web/lib/server/v3/in-person");
const { prepareTokenBuy } = await import("../../apps/web/lib/server/v3/token-buy");
const { shopQuote } = await import("../../apps/web/lib/server/v3/shop");
const { prepareOrder, saveProof } = await import("../../apps/web/lib/server/v3/service");
const { samplePhoQr } = await import("../../packages/core/src/index");
type Session = import("../../apps/web/lib/server/v3/auth").Session;

const exp = Date.now() + 24 * 3600_000;
const s = (account_id: string): Session => ({ account_id, standard: "nep413", exp });
const mai = s("mai.demo.near");
const tom = s("tom.demo.near");
const linh = s("linh.demo.near");
const minh = s("minh.demo.near");
const hermes = s("hermes.demo.near");
const shopper = s("shopper.mock.near");
const dao = s("dao.demo.near"); // a registered fulfiller with no jobs yet (empty Active and Earnings)
const backend = new MockEscrow();
const HOUR_NS = BigInt(3_600_000_000_000);

const call = (account: Session, msg: Record<string, unknown>) =>
  backend.apply(account.account_id, [{ intent: "auth_call", msg: JSON.stringify(msg) } as never]);
const fund = async (buyer: Session, prepared: { payload: { intents: unknown[] } }) =>
  backend.apply(buyer.account_id, prepared.payload.intents as never[]);
const usdc = (value: string) => String(Math.round(Number(value) * 1_000_000));

/** Move an order's event times back so the activity list spans a few days. */
function age(id: string, hours: number) {
  for (const prefix of ["v3:order", "v3:final"]) {
    const order = get<Record<string, unknown>>(`${prefix}:${id}`);
    if (!order) continue;
    for (const field of ["created_at", "claimed_at", "claimed_at_ns", "sent_at", "verify_started_at", "verified_at", "paid_at", "ended_at"]) {
      if (typeof order[field] === "string" && /^\d{15,}$/.test(order[field] as string))
        order[field] = String(BigInt(order[field] as string) - BigInt(Math.round(hours * 60)) * (HOUR_NS / BigInt(60)));
    }
    put(`${prefix}:${id}`, prefix, order);
  }
  const summary = get<Record<string, unknown>>(`v3:spec_summary:${id}`);
  if (summary?.created_at) put(`v3:spec_summary:${id}`, "v3:spec_summary", { ...summary, created_at: new Date(Date.now() - hours * 3600_000).toISOString() });
}

async function jsonProof(owner: Session, id: string, extra: Record<string, unknown> = {}) {
  const body = Buffer.from(JSON.stringify({ order_id: id, nonce: randomBytes(6).toString("hex"), ...extra }));
  const saved = await saveProof(owner, id, body, "application/json");
  const stored = get<{ spec: string }>(`v3:spec:${id}`)!;
  await call(owner, { op: "submit_proof", order_id: id, proof_sha256: saved.sha256, spec: stored.spec });
}
async function emailProof(owner: Session, id: string) {
  const body = Buffer.from(`From: noreply@vpbank.com.vn\nSubject: Bien dong so du\n\nNoi dung: ${id}\nref ${randomBytes(6).toString("hex")}\n`);
  const saved = await saveProof(owner, id, body, "message/rfc822");
  const stored = get<{ spec: string }>(`v3:spec:${id}`)!;
  await call(owner, { op: "submit_proof", order_id: id, proof_sha256: saved.sha256, spec: stored.spec });
}

for (const who of [mai, tom, linh, minh, hermes, shopper, dao]) await backend.seed(who.account_id);
put("v3:user-profile:linh.demo.near", "v3:user-profile", {
  account_id: "linh.demo.near", display_name: "Linh Tran", bio: "Local in Da Nang. Fast with cafes, pharmacies and SIM cards.",
  contacts: { telegram: "linh_danang" }, updated_at: new Date().toISOString() });
put("v3:user-profile:minh.demo.near", "v3:user-profile", {
  account_id: "minh.demo.near", display_name: "Minh Le", bio: "Hanoi runner. Bank transfers and phone top-ups.",
  contacts: { x: "minh_runs" }, updated_at: new Date().toISOString() });
put("v3:user-profile:mai.demo.near", "v3:user-profile", {
  account_id: "mai.demo.near", display_name: "Mai", bio: "", contacts: {}, updated_at: new Date().toISOString() });
await call(linh, { op: "register_fulfiller", bank_bin: "970432", account_last4: "4821" });
await call(minh, { op: "register_fulfiller", bank_bin: "970432", account_last4: "9034" });
await call(hermes, { op: "register_fulfiller" });
await call(dao, { op: "register_fulfiller" });
await call(shopper, { op: "register_fulfiller" });
const made: string[] = [];
/** Open claims are limited to one per new fulfiller, so lingering claims run last. */
const later: Array<() => Promise<void>> = [];
/** The mock swap route returns tiny raw amounts; scale them so the demo shows a believable token amount (display only). */
function scaleToken(id: string) {
  const k = BigInt(10) ** BigInt(12);
  const round = BigInt(10) ** BigInt(15);
  const scale = (v: unknown) => String((BigInt(String(v)) * k) / round * round);
  const spec = get<Record<string, any>>(`v3:spec:${id}`);
  if (spec?.kind === "token_buy") {
    spec.quote.estimated_out = scale(spec.quote.estimated_out);
    spec.quote.amount_out = scale(spec.quote.amount_out);
    const parsed = JSON.parse(spec.spec) as Record<string, unknown>;
    parsed.amount_out = scale(parsed.amount_out);
    spec.spec = JSON.stringify(parsed); // display only: the order is already funded, so the hash is no longer checked
    put(`v3:spec:${id}`, "v3:spec", spec);
    const pub = get<Record<string, any>>(`v3:token_public:${id}`);
    if (pub) { pub.spec.amount_out = scale(pub.spec.amount_out); put(`v3:token_public:${id}`, "v3:token_public", pub); }
    const sum = get<Record<string, any>>(`v3:spec_summary:${id}`);
    if (sum) { sum.denomination = scale(sum.denomination); put(`v3:spec_summary:${id}`, "v3:spec_summary", sum); }
  }
}
const track = (id: string, hours: number) => { made.push(id); age(id, hours); return id; };

// ---- in person ---------------------------------------------------------
const secret = (n: number) => createHash("sha256").update(`demo-${n}`).digest("hex");
const ip = async (buyer: Session, n: number, item: string, price: string, area: string, place: string, hours = 20) => {
  const code = secret(n);
  const p = await prepareInPerson(buyer, { area, item_desc: item, price: usdc(price),
    delivery_hash: createHash("sha256").update(Buffer.from(code, "hex")).digest("hex"),
    meetup_address: place, meetup_contact: "Telegram @" + buyer.account_id.split(".")[0], deadline_hours: hours });
  await fund(buyer, p);
  return { id: p.order_id, code };
};
const ipOpen = await ip(mai, 1, "Iced coffee (cà phê sữa đá)", "2.50", "My Khe, Da Nang", "Highlands Coffee, 25 Vo Nguyen Giap");
track(ipOpen.id, 0.5);
const ipOpen2 = await ip(tom, 2, "Paracetamol and electrolyte packets", "4.00", "Hai Chau, Da Nang", "Han River Pharmacy, 12 Bach Dang");
track(ipOpen2.id, 2);
const ipClaimed = await ip(tom, 3, "Local SIM card with 10 GB data", "6.00", "An Thuong, Da Nang", "Cafe 43 Factory, An Thuong 2");
later.push(async () => { await call(linh, { op: "claim", order_id: ipClaimed.id }); });
track(ipClaimed.id, 3);
const ipPaid = await ip(mai, 4, "Banh mi and fresh juice", "3.20", "Son Tra, Da Nang", "Bach Dang riverside, near the dragon bridge");
await call(linh, { op: "claim", order_id: ipPaid.id });
await call(linh, { op: "confirm_delivery", order_id: ipPaid.id, secret_hex: ipPaid.code });
await call(mai, { op: "rate", order_id: ipPaid.id, stars: 5 });
track(ipPaid.id, 30);
const ipPaid2 = await ip(tom, 5, "Concert ticket (pick-up at the box office)", "12.00", "Hai Chau, Da Nang", "Da Nang Opera House, box office", 12);
await call(minh, { op: "claim", order_id: ipPaid2.id });
await call(minh, { op: "confirm_delivery", order_id: ipPaid2.id, secret_hex: ipPaid2.code });
await call(tom, { op: "rate", order_id: ipPaid2.id, stars: 4 });
track(ipPaid2.id, 55);
const ipCancel = await ip(mai, 6, "A paperback novel", "5.00", "Hoi An", "Hoi An Bookshop, Tran Phu");
await call(mai, { op: "cancel", order_id: ipCancel.id });
track(ipCancel.id, 70);
const ipExpired = await ip(tom, 7, "Birthday cake (small)", "8.00", "Ngu Hanh Son, Da Nang", "Tous les Jours, Vincom Plaza", 1);
await call(minh, { op: "claim", order_id: ipExpired.id });
await new MockEscrow({}, () => BigInt(Date.now() + 2 * 3600_000) * BigInt(1_000_000)).expire(ipExpired.id);
track(ipExpired.id, 80);

// ---- token buy ---------------------------------------------------------
const tokenOrders: Array<{ id: string }> = [];
try {
  const tk = async (buyer: Session, spend: string, contract: string, receiver: string) => {
    const p = await prepareTokenBuy(buyer, { token_contract: contract, receiver, spend_usdc: usdc(spend), slippage_bps: 300, deadline_hours: 12 });
    await fund(buyer, p);
    tokenOrders.push({ id: p.order_id });
    return p.order_id;
  };
  const t1 = await tk(mai, "2", "blackdragon.near", "mai.near");
  track(t1, 1);
  const t2 = await tk(tom, "1", "blackdragon.near", "tom.near");
  later.push(async () => { await call(hermes, { op: "claim", order_id: t2 }); });
  track(t2, 4);
  const t3 = await tk(mai, "5", "blackdragon.near", "mai.near");
  await call(hermes, { op: "claim", order_id: t3 });
  await jsonProof(hermes, t3, { tx_hash: "5".repeat(44) });
  track(t3, 26);
  const t4 = await tk(tom, "3", "blackdragon.near", "tom.near");
  later.push(async () => {
    await call(shopper, { op: "claim", order_id: t4 });
    put(`v3:verify:${t4}`, "v3:verify", { ok: false, reason: "no ft_transfer to receiver found" });
    await jsonProof(shopper, t4, { tx_hash: "6".repeat(44) });
  });
  track(t4, 7);
} catch (error) {
  console.warn("Skipped token orders (needs network for token info):", (error as Error).message);
}

// ---- shop (Cryptorefills mock catalog) ---------------------------------
const quote = (buyer: Session, input: Record<string, unknown>) =>
  shopQuote(buyer, { country: "VN", ...input }) as Promise<{ order_id: string; payload: { intents: unknown[] } }>;
const topup = async (buyer: Session, phone: string) => {
  const q = await quote(buyer, { brand_name: "Viettel Mobile Credits", denomination: "20000 VND", beneficiary: phone, buyer_email: `${buyer.account_id.split(".")[0]}.demo@example.com` });
  await fund(buyer, q);
  return q.order_id;
};
try {
  const a = await topup(mai, "+84912345678");
  track(a, 1.5);
  const b = await topup(tom, "+84987654321");
  later.push(async () => { await call(minh, { op: "claim", order_id: b }); });
  track(b, 5);
  const c = await topup(mai, "+84912345678");
  age(c, 1);
  await call(linh, { op: "claim", order_id: c });
  await jsonProof(linh, c, { status: "delivered", reference: "CR-" + randomBytes(3).toString("hex") });
  track(c, 40);
  const d = await topup(tom, "+84987654321");
  age(d, 1);
  await call(minh, { op: "claim", order_id: d });
  await jsonProof(minh, d, { status: "delivered", reference: "CR-" + randomBytes(3).toString("hex") });
  await call(tom, { op: "dispute", order_id: d, reason_code: 2 });
  track(d, 20);
  const gift = await quote(tom, { brand_name: "Synthetic Game Card", denomination: "5 USD", beneficiary: "tom.demo@example.com", buyer_email: "tom.demo@example.com" }).catch(() => null);
  if (gift) {
    await fund(tom, gift);
    await call(shopper, { op: "claim", order_id: gift.order_id });
    await jsonProof(shopper, gift.order_id, { status: "delivered", reference: "CR-" + randomBytes(3).toString("hex") });
    track(gift.order_id, 90);
  }
  const esim = await quote(mai, { brand_name: "Travel eSIM", denomination: "1 GB 3 days", beneficiary: "mai.demo@example.com", buyer_email: "mai.demo@example.com" }).catch(() => null);
  if (esim) {
    await fund(mai, esim);
    track(esim.order_id, 0.2);
  }
} catch (error) {
  console.warn("Skipped some shop orders:", (error as Error).message);
}

// ---- bank QR (local payments, beta) ------------------------------------
const bank = async (buyer: Session, amount: number, reward: string) => {
  const p = await prepareOrder(buyer, { qr_payload: samplePhoQr(amount), amount_vnd: amount, reward_usdc: reward });
  await fund(buyer, p);
  return p.order.id;
};
const b1 = await bank(mai, 85_000, "0.5");
track(b1, 0.8);
const b2 = await bank(tom, 120_000, "0.6");
later.push(async () => { await call(minh, { op: "claim", order_id: b2 }); });
track(b2, 3);
const b3 = await bank(mai, 45_000, "0.4");
later.push(async () => { await call(linh, { op: "claim", order_id: b3 }); await call(linh, { op: "sent", order_id: b3 }); });
track(b3, 6);
const b4 = await bank(tom, 150_000, "0.5");
await call(minh, { op: "claim", order_id: b4 });
await call(minh, { op: "sent", order_id: b4 });
await emailProof(minh, b4);
await call(tom, { op: "rate", order_id: b4, stars: 5 });
track(b4, 36);
const b5 = await bank(mai, 60_000, "0.5");
later.push(async () => {
  await call(linh, { op: "claim", order_id: b5 });
  await call(linh, { op: "sent", order_id: b5 });
  put(`v3:verify:${b5}`, "v3:verify", { ok: false, reason: "amount too low" });
  await emailProof(linh, b5);
});
track(b5, 9);
const b6 = await bank(tom, 200_000, "0.7");
await call(minh, { op: "claim", order_id: b6 });
await call(minh, { op: "sent", order_id: b6 });
await emailProof(minh, b6);
await call(tom, { op: "dispute", order_id: b6, reason_code: 1 });
track(b6, 14);
const b7 = await bank(mai, 70_000, "0.5");
await call(linh, { op: "claim", order_id: b7 });
await call(linh, { op: "sent", order_id: b7 });
await emailProof(linh, b7);
await call(mai, { op: "dispute", order_id: b7, reason_code: 1 });
await backend.resolve(b7, "buyer");
track(b7, 100);

// ---- Mai also works as a fulfiller: 3 paid jobs with ratings, plus 1 active claim ----------
await call(mai, { op: "register_fulfiller", bank_bin: "970432", account_last4: "5521" });
const maiJob1 = await ip(tom, 20, "Fresh fruit bag from the market", "4.00", "Hai Chau, Da Nang", "Han Market, east gate");
await call(mai, { op: "claim", order_id: maiJob1.id });
await call(mai, { op: "confirm_delivery", order_id: maiJob1.id, secret_hex: maiJob1.code });
await call(tom, { op: "rate", order_id: maiJob1.id, stars: 5 });
track(maiJob1.id, 52);
const maiJob2 = await bank(tom, 95_000, "0.6");
await call(mai, { op: "claim", order_id: maiJob2 });
await call(mai, { op: "sent", order_id: maiJob2 });
await emailProof(mai, maiJob2);
await call(tom, { op: "rate", order_id: maiJob2, stars: 4 });
track(maiJob2, 30);
const maiJob3 = await ip(tom, 21, "Pharmacy run: vitamins and plasters", "3.20", "Son Tra, Da Nang", "Pharmacity, 88 Ngo Quyen");
await call(mai, { op: "claim", order_id: maiJob3.id });
await call(mai, { op: "confirm_delivery", order_id: maiJob3.id, secret_hex: maiJob3.code });
await call(tom, { op: "rate", order_id: maiJob3.id, stars: 5 });
track(maiJob3.id, 7);
const maiActive = await ip(tom, 22, "Phone charger cable (USB-C)", "5.50", "Hai Chau, Da Nang", "Cafe Bap, 21 Tran Phu");
track(maiActive.id, 1);
later.push(async () => { await call(mai, { op: "claim", order_id: maiActive.id }); });

for (const step of later) await step();
for (const id of made) scaleToken(id);
console.log(`Seeded ${made.length} orders into ${target}`);
console.log("Buyers:     mai.demo.near, tom.demo.near");
console.log("Fulfillers: linh.demo.near, minh.demo.near, and mai.demo.near (also a buyer; 3 paid jobs + 1 active)");
console.log("             hermes.demo.near = token agent; dao.demo.near = new fulfiller, no jobs");
