import { NextRequest, NextResponse } from "next/server";
import {
  act,
  addQuote,
  changeBond,
  createOrder,
  fulfillers,
  orderById,
  orders,
  parseQr,
  preview,
  sampleQr,
  status,
} from "../../../lib/server/service";
import {
  HttpError,
  cancelQrOrder,
  claimJob,
  confirmQrOrder,
  createQrOrder,
  demoStep,
  disputeQrOrder,
  earnings,
  fundQrOrder,
  getJob,
  getQrOrder,
  listJobs,
  listQrOrders,
  markSent,
  previewQr,
  settleQrOrder,
  submitProof,
} from "../../../lib/server/qr-service";
import { samplePhoQr } from "@fulfil/core";
import { get, key } from "../../../lib/server/db";
import { verifyBundle } from "@fulfil/attest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status });
function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError)
    return json({ error: error.message, code: error.code }, error.status);
  const message = error instanceof Error ? error.message : "Internal error";
  const status = /not found/i.test(message)
    ? 404
    : /not|cannot|invalid|expired|insufficient|unavailable|missing|closed|exceed|mismatch|amount|qr|limit|required|outcome|state|already|only|dispute|appeal/i.test(
          message,
        )
      ? 400
      : 500;
  return json(
    {
      error: message,
      code:
        status === 404
          ? "NOT_FOUND"
          : status === 400
            ? "BAD_REQUEST"
            : "INTERNAL_ERROR",
    },
    status,
  );
}
async function body(request: NextRequest): Promise<any> {
  try {
    const text = await request.text();
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    throw new Error("Invalid JSON body");
  }
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const path = (await context.params).path;
    const query = request.nextUrl.searchParams;
    if (path[0] === "status") return json(status());
    if (path[0] === "qr" && path[1] === "orders" && path.length === 2)
      return json(listQrOrders(query.get("requester") || undefined));
    if (path[0] === "qr" && path[1] === "orders" && path.length === 3)
      return json(getQrOrder(path[2]));
    if (path[0] === "jobs" && path.length === 1)
      return json(
        listJobs({
          fulfiller: query.get("fulfiller") || undefined,
          scope: query.get("scope") || undefined,
        }),
      );
    if (path[0] === "jobs" && path[1] === "earnings")
      return json(earnings(query.get("fulfiller") || ""));
    if (path[0] === "jobs" && path.length === 2)
      return json(getJob(path[1], query.get("fulfiller") || undefined));
    if (path[0] === "orders" && path.length === 1) return json(orders());
    if (path[0] === "orders" && path.length === 2) {
      const order = orderById(path[1]);
      if (!order) throw new Error("Order not found");
      return json(order);
    }
    if (path[0] === "orders" && path[2] === "quotes") {
      const order = orderById(path[1]);
      if (!order) throw new Error("Order not found");
      return json(order.quotes.sort((a, b) => a.totalUsd - b.totalUsd));
    }
    if (path[0] === "fulfillers") return json(fulfillers());
    if (path[0] === "cases")
      return json(orders().filter((order) => !!order.dispute));
    if (path[0] === "qr" && path[1] === "samples")
      return json({
        vietqr: {
          payload: sampleQr("vietqr"),
          imageUrl: "/api/fixtures/vietqr.svg",
        },
        pho: {
          payload: samplePhoQr(50_000),
          imageUrl: "/api/fixtures/vietqr-pho.svg",
          merchant: "PHO BAY SAO DEMO",
          amountVnd: 50_000,
        },
        promptpay: {
          payload: sampleQr("promptpay"),
          imageUrl: "/api/fixtures/promptpay.svg",
        },
      });
    if (path[0] === "bundles" && path[1]) {
      const bundle = get(key("bundle", path[1]));
      if (!bundle) throw new Error("Bundle not found");
      return json(bundle);
    }
    if (path[0] === "fixtures" && path[1]) {
      const allowed = new Set([
        "sample.eml",
        "ticket.pdf",
        "mismatch.pdf",
        "vietqr.svg",
        "promptpay.svg",
        "lotus-notice-valid.eml",
        "lotus-notice-wrong-amount.eml",
        "lotus-notice-tampered.eml",
        "vietqr-pho.svg",
      ]);
      if (!allowed.has(path[1])) throw new Error("Fixture not found");
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const bytes = await readFile(
        resolve(
          process.cwd(),
          process.cwd().endsWith("/apps/web") ? "../../fixtures" : "fixtures",
          path[1],
        ),
      );
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": path[1].endsWith(".svg")
            ? "image/svg+xml"
            : path[1].endsWith(".pdf")
              ? "application/pdf"
              : "message/rfc822",
        },
      });
    }
    throw new Error("Route not found");
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const path = (await context.params).path;
    const input = await body(request);
    if (path[0] === "qr" && path[1] === "preview")
      return json(await previewQr(input));
    if (path[0] === "qr" && path[1] === "orders" && path.length === 2)
      return json(await createQrOrder(input), 201);
    if (path[0] === "qr" && path[1] === "orders" && path[3] === "fund")
      return json(fundQrOrder(path[2], input));
    if (path[0] === "qr" && path[1] === "orders" && path[3] === "cancel")
      return json(cancelQrOrder(path[2]));
    if (path[0] === "qr" && path[1] === "orders" && path[3] === "confirm")
      return json(confirmQrOrder(path[2], input));
    if (path[0] === "qr" && path[1] === "orders" && path[3] === "dispute")
      return json(await disputeQrOrder(path[2], input));
    if (path[0] === "qr" && path[1] === "orders" && path[3] === "settle")
      return json(await settleQrOrder(path[2]));
    if (path[0] === "jobs" && path[2] === "claim")
      return json(claimJob(path[1], String(input.fulfiller ?? "")));
    if (path[0] === "jobs" && path[2] === "sent")
      return json(markSent(path[1], String(input.fulfiller ?? "")));
    if (path[0] === "jobs" && path[2] === "proof")
      return json(submitProof(path[1], { ...input, fulfiller: String(input.fulfiller ?? "") }));
    if (path[0] === "demo" && path[1] === "qr" && path[2] === "step")
      return json(demoStep(input));
    if (path[0] === "orders" && path[1] === "preview")
      return json(await preview(input));
    if (path[0] === "orders" && path.length === 1)
      return json(await createOrder(input), 201);
    if (path[0] === "orders" && path[2] === "actions")
      return json(await act(path[1], input));
    if (path[0] === "orders" && path[2] === "quotes")
      return json(addQuote(path[1], input), 201);
    if (path[0] === "fulfillers" && path[2] === "bond")
      return json(changeBond(path[1], input));
    if (path[0] === "qr" && path[1] === "parse")
      return json(parseQr(input.payload));
    if (path[0] === "bundles" && path[2] === "verify") {
      const bundle = get(key("bundle", path[1]));
      if (!bundle) throw new Error("Bundle not found");
      return json(await verifyBundle(bundle as any));
    }
    throw new Error("Route not found");
  } catch (error) {
    return errorResponse(error);
  }
}
