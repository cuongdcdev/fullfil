import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { NextRequest } from "next/server";

const databasePath = `/tmp/fulfil-api-regression-${process.pid}.db`;
process.env.DATABASE_URL = `file:${databasePath}`;
process.env.NEAR_AI_API_KEY = "";
process.env.SAGE_API_KEY = "";

let act: typeof import("../apps/web/lib/server/service").act;
let createOrder: typeof import("../apps/web/lib/server/service").createOrder;
let post: typeof import("../apps/web/app/api/[...path]/route").POST;

const request =
  "Get me 2 tickets for the Cham Islands ferry, Saturday, max $40, names Alice Nguyen and Bob Tran";

beforeAll(async () => {
  for (const suffix of ["", "-shm", "-wal"]) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) unlinkSync(path);
  }
  ({ act, createOrder } = await import("../apps/web/lib/server/service"));
  ({ POST: post } = await import("../apps/web/app/api/[...path]/route"));
});

afterAll(() => {
  for (const suffix of ["", "-shm", "-wal"]) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) unlinkSync(path);
  }
});

async function postJson(path: string[], body: unknown) {
  return post(
    new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ path }) },
  );
}

describe("HTTP input and action replay guards", () => {
  it("returns BAD_REQUEST for malformed QR and negative bond amounts", async () => {
    const qr = await postJson(["qr", "parse"], { payload: "not-a-qr" });
    expect(qr.status).toBe(400);
    expect(await qr.json()).toMatchObject({ code: "BAD_REQUEST" });

    const bond = await postJson(["fulfillers", "linh.fulfil.testnet", "bond"], {
      action: "topup",
      amountUsd: -1,
    });
    expect(bond.status).toBe(400);
    expect(await bond.json()).toMatchObject({ code: "BAD_REQUEST" });
  });

  it("serializes concurrent evidence submission so only one succeeds", async () => {
    const order = await createOrder({ request });
    const quote = order.quotes[0];
    await act(order.id, { action: "accept_quote", quoteId: quote.id });
    await act(order.id, { action: "fund" });

    const results = await Promise.allSettled([
      act(order.id, { action: "submit_evidence", sample: "valid" }),
      act(order.id, { action: "submit_evidence", sample: "valid" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
