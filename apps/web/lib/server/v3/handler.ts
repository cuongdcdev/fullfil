import { NextResponse } from "next/server";
import {
  cookieHeader,
  createChallenge,
  sessionFromRequest,
  verifyLogin,
  IntentsKeyMissingError,
  type Session,
  bearerMatches,
} from "./auth";
import { escrowBackend, MockEscrow, orderStatuses } from "./escrow";
import { mode, USDC_TOKEN } from "./config";
import {
  buildPayload,
  intentFromInput,
  validateSignedPayload,
  type Intent,
} from "./intents";
import {
  fxEstimate,
  orderDetail,
  orderListItem,
  prepareOrder,
  resolveDispute,
  saveProof,
  submitIntents,
  topupQuote,
  topupStatus,
  topupTokens,
  withdrawQuote,
  assertPreparedFunding,
  recordDisputeStatement,
  assertProofIntent,
  jobSpec,
} from "./service";
import { allowRequest } from "./rate-limit";
import { publicStatus } from "./status";
import { canonicalJson } from "@fulfil/core";
import { officialFulfiller, registryEntryVerified } from "./fulfiller-status";
import {
  pruneStoredSpecsIfDue,
  shopBrand,
  shopCatalog,
  shopCountries,
  shopPopular,
  shopQuote,
  shopEstimate,
  warmCatalogInBackground,
  ShopNotFoundError,
  ShopUpstreamError,
} from "./shop";
import registry from "../../../../../fulfillers/registry.json";
import { assertSentAllowed, confirmInPerson, expireBuyerOrder, expireInPerson, inPersonMeetup, prepareInPerson } from "./in-person";
import { checkAccount, prepareTokenBuy, searchTokens, tokenInfo, tokenOrderFields, TokenBuyError } from "./token-buy";
import { canSeeCounterpartyContacts, saveUserProfile, userProfile } from "./user-profile";

type Context = { params: Promise<{ path: string[] }> };
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers });
const error = (code: string, message: string, status: number) =>
  json({ error: { code, message } }, status);
const pathOf = async (context: Context) =>
  (await context.params).path.join("/");

async function body(request: Request): Promise<Record<string, unknown>> {
  const parsed = await request.json().catch(() => {
    throw new Error("Invalid JSON body");
  });
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("JSON object required");
  return parsed as Record<string, unknown>;
}

function requiredSession(request: Request): Session {
  const session = sessionFromRequest(request);
  if (!session) throw new Error("SESSION_REQUIRED");
  return session;
}

function caught(errorValue: unknown) {
  if (errorValue instanceof IntentsKeyMissingError)
    return json(
      {
        error: {
          code: "intents_key_missing",
          message: errorValue.message,
          public_key: errorValue.publicKey,
        },
      },
      400,
    );
  if (errorValue instanceof TokenBuyError)
    return error(errorValue.code, errorValue.message, errorValue.status);
  if (errorValue instanceof ShopNotFoundError)
    return error("not_found", errorValue.message, 404);
  if (errorValue instanceof ShopUpstreamError)
    return error("upstream_unavailable", "The shop service is unavailable. Please try again.", 502);
  const message =
    errorValue instanceof Error ? errorValue.message : "Unknown error";
  if (message === "SESSION_REQUIRED")
    return error("unauthorized", "Wallet session required", 401);
  if (message === "PROOF_TOO_LARGE")
    return error("proof_too_large", "Proof must be at most 64 KiB", 413);
  if (message === "RATE_LIMITED")
    return error("rate_limited", "Too many requests", 429);
  if (message === "FORBIDDEN_JOB_SPEC")
    return error("forbidden", "Only the current claimed fulfiller can access this spec", 403);
  if (message === "FORBIDDEN_IN_PERSON")
    return error("forbidden", "Only the buyer can request this refund", 403);
  if (
    message.includes("required in live mode") ||
    message.includes("OUTLAYER_API_KEY is required")
  )
    return error("not_configured", message, 503);
  // A contract panic (e.g. inside simulate_intents) is a rejection, not an outage.
  const panic = message.startsWith("NEAR RPC query failed")
    ? /panicked(?: at)?:?\s*([^"\\]{3,200})/.exec(message) ??
      /ExecutionError\(\\?"([^"\\]{3,200})/.exec(message)
    : null;
  if (panic) return error("contract_rejected", `The contract rejected this: ${panic[1].trim()}`, 400);
  if (message.includes("not found")) return error("not_found", message, 404);
  if (
    message.includes("already") ||
    message.includes("not allowed") ||
    message.includes("cannot")
  )
    return error("conflict", message, 409);
  if (
    message.startsWith("1Click HTTP") ||
    message.startsWith("1Click upstream") ||
    message.startsWith("Cryptorefills HTTP") ||
    message.startsWith("Cryptorefills upstream") ||
    message.startsWith("OutLayer") ||
    message.startsWith("NEAR RPC")
  )
    return error("upstream_error", message, 502);
  return error("invalid_request", message, 400);
}

export async function GET(request: Request, context: Context) {
  try {
    const path = await pathOf(context);
    if (path === "auth/session") {
      const session = sessionFromRequest(request);
      if (!session) return json({ authenticated: false });
      return json({
        authenticated: true,
        account_id: session.account_id,
        standard: session.standard,
        expires_at: new Date(session.exp).toISOString(),
      });
    }
    if (path === "status") {
      if (!allowRequest(request, "shop")) throw new Error("RATE_LIMITED");
      return json(await publicStatus(), 200, { "Cache-Control": "no-store" });
    }
    if (path === "fx") {
      const vnd = new URL(request.url).searchParams.get("vnd");
      return json(await fxEstimate(vnd));
    }
    const publicShopRoute = [
      "shop/catalog",
      "shop/brand",
      "shop/popular",
      "shop/countries",
      "shop/estimate",
      "fulfillers",
      "token/search",
      "token/info",
      "account/check",
    ].includes(path);
    if (publicShopRoute && !allowRequest(request, "shop")) {
      throw new Error("RATE_LIMITED");
    }
    const publicUrl = new URL(request.url);
    if (path === "token/search") return json(await searchTokens(publicUrl.searchParams.get("q")));
    if (path === "token/info") return json(await tokenInfo(publicUrl.searchParams.get("id")));
    if (path === "account/check") return json(await checkAccount(publicUrl.searchParams.get("id")));
    if (path.startsWith("shop/")) warmCatalogInBackground();
    if (path === "shop/catalog") {
      return json(await shopCatalog(publicUrl.searchParams.get("country") || "VN"));
    }
    if (path === "shop/brand") {
      return json(await shopBrand(
        publicUrl.searchParams.get("country") || "VN",
        publicUrl.searchParams.get("slug") || "",
      ));
    }
    if (path === "shop/popular") {
      return json(await shopPopular(publicUrl.searchParams.get("country") || "VN"));
    }
    if (path === "shop/countries") {
      return json(await shopCountries());
    }
    if (path === "shop/estimate") {
      return json(await shopEstimate(
        publicUrl.searchParams.get("country") || "VN",
        publicUrl.searchParams.get("brand") || "",
      ));
    }
    if (path === "fulfillers") {
      const backend = escrowBackend();
      return json(await Promise.all(registry.map(async (entry) => {
        const profile = await backend.profile(entry.account_id).catch(() => null);
        return {
          ...entry,
          verified: await registryEntryVerified(entry),
          official: officialFulfiller(entry.account_id),
          profile,
          stats: profile?.stats ?? null,
          user_profile: (({ display_name, bio }) => ({ display_name, bio }))(userProfile(entry.account_id)),
        };
      })));
    }
    if (/^user-profile\/[^/]+$/.test(path)) {
      const accountId = decodeURIComponent(path.slice("user-profile/".length));
      if (!/^[a-z0-9._-]{2,64}$/.test(accountId)) throw new Error("Invalid account id");
      if (!allowRequest(request, "shop")) throw new Error("RATE_LIMITED");
      const profile = userProfile(accountId);
      const entry = registry.find((item) => item.account_id === accountId);
      const backend = escrowBackend();
      const orders = await backend.orders(undefined, accountId, 0, 100);
      const fulfilled = orders.filter((order) => order.fulfiller === accountId);
      const kinds = [...new Set([...(entry?.kinds ?? []), ...fulfilled.map((order) => order.kind)])];
      const completed_orders = (await backend.profile(accountId)).stats.jobs_done;
      return json({ account_id: accountId, display_name: profile.display_name, bio: profile.bio, kinds, completed_orders });
    }
    // Order detail is public: the order itself is on chain, and orderDetail
    // hides the merchant account and pay QR from anyone but buyer/fulfiller.
    if (/^orders\/[^/]+$/.test(path)) {
      const viewer = sessionFromRequest(request)?.account_id ?? "";
      if (!viewer && !allowRequest(request, "shop")) throw new Error("RATE_LIMITED");
      const result = await orderDetail(decodeURIComponent(path.slice(7)), viewer);
      return result ? json(result) : error("not_found", "Order not found", 404);
    }
    const session = requiredSession(request);
    const url = new URL(request.url);
    // The store contains delivery PII. Sweep it when a normal authenticated
    // order read reaches this server, as well as on quote and job-spec paths.
    await pruneStoredSpecsIfDue();
    if (path === "me") {
      const backend = escrowBackend();
      const profile = await backend.profile(session.account_id);
      return json({
        account: session.account_id,
        intents_balances: {
          [USDC_TOKEN]: await backend.balance(session.account_id),
        },
        profile,
        approved: profile.approved,
      });
    }
    if (path === "me/profile") return json(userProfile(session.account_id), 200, { "Cache-Control": "no-store" });
    if (/^orders\/[^/]+\/contact$/.test(path)) {
      const id = decodeURIComponent(path.split("/")[1]);
      const order = await escrowBackend().order(id);
      if (!order) return error("not_found", "Order not found", 404);
      if (!canSeeCounterpartyContacts(order, session.account_id))
        return error("forbidden", "Contact details are unavailable", 403);
      const accountId = order.buyer === session.account_id ? order.fulfiller! : order.buyer;
      const profile = userProfile(accountId);
      return json({ account_id: accountId, display_name: profile.display_name, contacts: profile.contacts }, 200, { "Cache-Control": "no-store" });
    }
    if (path === "orders") {
      const status = url.searchParams.get("status") || undefined;
      const kind = url.searchParams.get("kind") || undefined;
      if (kind && !["bank_transfer", "cryptorefills_topup", "cryptorefills_code", "in_person", "token_buy"].includes(kind)) {
        throw new Error("Invalid kind");
      }
      if (status && !orderStatuses.some((candidate) => candidate === status)) {
        throw new Error("Invalid status");
      }
      const account = url.searchParams.get("account") || undefined;
      const from = Math.max(0, Number(url.searchParams.get("from") || 0));
      const limit = Math.min(
        100,
        Math.max(1, Number(url.searchParams.get("limit") || 50)),
      );
      let orders;
      let hasMore = false;
      if (kind) {
        const matches = [];
        let offset = 0;
        while (matches.length <= from + limit) {
          const page = await escrowBackend().orders(status, account, offset, 100);
          matches.push(...page.filter((order) => order.kind === kind));
          offset += page.length;
          if (page.length < 100) break;
        }
        orders = matches.slice(from, from + limit);
        hasMore = matches.length > from + limit;
      } else {
        orders = await escrowBackend().orders(status, account, from, limit);
        hasMore = orders.length === limit;
      }
      return json({
        orders: await Promise.all(orders.map(async (order) => ({
          ...orderListItem(order),
          ...(order.kind === "token_buy" ? await tokenOrderFields(order.id, order.proof_sha256) : {}),
        }))),
        next_from: hasMore ? from + orders.length : undefined,
      });
    }
    if (/^jobs\/[^/]+\/spec$/.test(path)) return json(await jobSpec(session, path.split("/")[1]));
    if (/^jobs\/[^/]+\/meetup$/.test(path)) return json(await inPersonMeetup(session, path.split("/")[1]));
    if (path === "topup/status") {
      const depositAddress = url.searchParams.get("depositAddress");
      if (!depositAddress) throw new Error("depositAddress is required");
      return json(
        await topupStatus(
          session,
          depositAddress,
          url.searchParams.get("depositMemo") || undefined,
        ),
      );
    }
    if (path === "topup/tokens") return json(await topupTokens());
    return error("not_found", "Unknown route", 404);
  } catch (value) {
    return caught(value);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const path = await pathOf(context);
    if (path !== "me/profile") return error("not_found", "Unknown route", 404);
    const session = requiredSession(request);
    if (!allowRequest(request, "submit", session.account_id)) throw new Error("RATE_LIMITED");
    const input = await body(request);
    return json(saveUserProfile(session.account_id, {
      display_name: input.display_name,
      bio: input.bio,
      contacts: input.contacts,
    }));
  } catch (value) {
    return caught(value);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const path = await pathOf(context);
    if (path === "auth/challenge") {
      if (!allowRequest(request, "auth", sessionFromRequest(request)?.account_id))
        throw new Error("RATE_LIMITED");
      return json(createChallenge());
    }
    if (path === "auth/logout")
      return json({ ok: true }, 200, { "Set-Cookie": cookieHeader() });
    if (path === "auth/verify") {
      const input = await body(request);
      if (!allowRequest(request, "auth", String(input.account_id || input.address || "")))
        throw new Error("RATE_LIMITED");
      const session = await verifyLogin(input);
      if (mode() === "mock") await new MockEscrow().seed(session.account_id);
      return json(
        {
          account_id: session.account_id,
          standard: session.standard,
          expires_at: new Date(session.exp).toISOString(),
        },
        200,
        { "Set-Cookie": cookieHeader(session) },
      );
    }
    if (path === "auth/dev-login") {
      if (mode() !== "mock" || process.env.NODE_ENV === "production")
        return error("forbidden", "Dev login unavailable", 403);
      const input = await body(request);
      const accountId = String(input.account_id || "");
      if (
        !/^[a-z0-9._-]{2,64}$/.test(accountId) &&
        !/^0x[a-fA-F0-9]{40}$/.test(accountId)
      )
        throw new Error("Invalid account id");
      const standard = input.standard === "erc191" ? "erc191" : "nep413";
      const session: Session = {
        account_id: standard === "erc191" ? accountId.toLowerCase() : accountId,
        standard,
        exp: Date.now() + 24 * 60 * 60_000,
      };
      await new MockEscrow().seed(session.account_id);
      return json(
        {
          account_id: session.account_id,
          standard,
          expires_at: new Date(session.exp).toISOString(),
        },
        200,
        { "Set-Cookie": cookieHeader(session) },
      );
    }
    if (/^disputes\/[^/]+\/resolve$/.test(path)) {
      const match = bearerMatches(request, process.env.ARBITER_ADMIN_TOKEN);
      if (match === undefined)
        return error(
          "not_configured",
          "ARBITER_ADMIN_TOKEN is not configured",
          503,
        );
      if (!match) return error("unauthorized", "Invalid arbiter token", 401);
      const input: Record<string, unknown> = await body(request).catch(
        () => ({}),
      );
      return json(
        await resolveDispute(path.split("/")[1], String(input.reason || "")),
      );
    }
    const session = requiredSession(request);
    if (path === "intents/build") {
      const input = await body(request);
      if (input.op === "confirm_delivery") throw new Error("Use the in-person confirmation route");
      if (input.kind === "auth_call" && input.op === "sent") {
        await assertSentAllowed(String(input.order_id ?? ""));
      }
      const intents = [intentFromInput(input)];
      assertPreparedFunding(session, intents);
      await assertProofIntent(session, intents);
      recordDisputeStatement(session, input);
      return json(await buildPayload(session, intents));
    }
    if (path === "intents/submit") {
      if (!allowRequest(request, "submit", session.account_id)) throw new Error("RATE_LIMITED");
      const signed = await validateSignedPayload(session, await body(request));
      const payload =
        signed.standard === "nep413"
          ? (signed.payload as { message: string }).message
          : String(signed.payload);
      const intents = (JSON.parse(payload) as { intents: Intent[] }).intents;
      return json(await submitIntents(session, signed, intents));
    }
    if (path === "orders/prepare")
      return json(await prepareOrder(session, await body(request)));
    if (path === "in-person/prepare") {
      if (!allowRequest(request, "topup", session.account_id)) throw new Error("RATE_LIMITED");
      return json(await prepareInPerson(session, await body(request)));
    }
    if (path === "token/prepare") {
      if (!allowRequest(request, "topup", session.account_id)) throw new Error("RATE_LIMITED");
      return json(await prepareTokenBuy(session, await body(request)));
    }
    if (path === "in-person/confirm") {
      if (!allowRequest(request, "proofs", session.account_id)) throw new Error("RATE_LIMITED");
      const input = await body(request);
      return json(await confirmInPerson(session, String(input.order_id || ""), input.secret_hex as string));
    }
    if (path === "in-person/expire") {
      if (!allowRequest(request, "submit", session.account_id)) throw new Error("RATE_LIMITED");
      const input = await body(request);
      return json(await expireInPerson(session, String(input.order_id || "")));
    }
    if (path === "token/expire") {
      if (!allowRequest(request, "submit", session.account_id)) throw new Error("RATE_LIMITED");
      const input = await body(request);
      return json(await expireBuyerOrder(session, String(input.order_id || ""), "token_buy"));
    }
    if (path === "shop/quote") {
      if (!allowRequest(request, "topup", session.account_id)) throw new Error("RATE_LIMITED");
      return json(await shopQuote(session, await body(request)));
    }
    if (path === "topup/quote") {
      if (!allowRequest(request, "topup", session.account_id)) throw new Error("RATE_LIMITED");
      return json(await topupQuote(session, await body(request)));
    }
    if (path === "withdraw/quote")
      return json(await withdrawQuote(session, await body(request)));
    if (path === "proofs") {
      if (!allowRequest(request, "proofs", session.account_id)) throw new Error("RATE_LIMITED");
      if (Number(request.headers.get("content-length") || 0) > 65_536 + 10_000)
        return caught(new Error("PROOF_TOO_LARGE"));
      let id = new URL(request.url).searchParams.get("order_id") || "";
      let bytes: Buffer;
      if (request.headers.get("content-type")?.startsWith("application/json")) {
        const input = await body(request);
        id = String(input.order_id || id);
        if (Object.hasOwn(input, "tx_hash")) {
          const hash = input.tx_hash;
          if (typeof hash !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(hash)) {
            throw new TokenBuyError("invalid_tx_hash", "Invalid NEAR transaction hash");
          }
          const order = await escrowBackend().order(id);
          if (!order || order.kind !== "token_buy") {
            throw new TokenBuyError("invalid_request", "Token-buy order required");
          }
          if (order.fulfiller !== session.account_id || !["claimed", "proof_rejected"].includes(order.status)) {
            throw new TokenBuyError("forbidden", "Only the current claimer may submit proof", 403);
          }
          bytes = Buffer.from(canonicalJson({ order_id: id, tx_hash: hash }));
          return json(await saveProof(session, id, bytes, "application/json"));
        }
        const crOrderId = String(input.cr_order_id || "");
        const crOrderToken = String(input.cr_order_token || "");
        if (!crOrderId || !crOrderToken || crOrderId.length > 256 || crOrderToken.length > 512)
          throw new Error("Invalid Cryptorefills proof");
        const order = await escrowBackend().order(id);
        if (!order?.kind.startsWith("cryptorefills_")) {
          throw new TokenBuyError("invalid_request", "Cryptorefills order required");
        }
        bytes = Buffer.from(canonicalJson({ cr_order_id: crOrderId, cr_order_token: crOrderToken }));
        return json(await saveProof(session, id, bytes, "application/json"));
      }
      if (
        request.headers.get("content-type")?.startsWith("multipart/form-data")
      ) {
        const form = await request.formData();
        id = String(form.get("order_id") || id);
        const file = form.get("file");
        if (!(file instanceof File)) throw new Error("file is required");
        bytes = Buffer.from(await file.arrayBuffer());
      } else bytes = Buffer.from(await request.arrayBuffer());
      return json(await saveProof(session, id, bytes));
    }
    return error("not_found", "Unknown route", 404);
  } catch (value) {
    return caught(value);
  }
}
