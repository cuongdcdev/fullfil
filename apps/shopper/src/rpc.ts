import { HttpError } from "./diagnostics";
import { fetchWithTimeout, responseJson } from "./http";

export type EscrowOrder = {
  id: string;
  kind: string;
  status: string;
  spec_hash: string;
  fulfiller: string | null;
  pay_amount: string;
  quoted_by: string | null;
  created_at: string;
  deadline_ns: string;
  claimed_at?: string | null;
  sent_at: string | null;
};

export type ShopperKindConfig = { proof_timeout_ns: string; claim_timeout_ns?: string };

const DEFAULT_RPC_URL = "https://rpc.mainnet.fastnear.com";
const DEFAULT_ESCROW_CONTRACT = "nearfullfil.near";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function validOrder(value: unknown, id: string): EscrowOrder {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid escrow order view");
  }
  const order = value as Record<string, unknown>;
  if (order.id !== id || typeof order.kind !== "string" ||
    typeof order.status !== "string" || !/^[a-f0-9]{64}$/.test(String(order.spec_hash)) ||
    !(order.fulfiller === null || typeof order.fulfiller === "string") ||
    !/^\d+$/.test(String(order.pay_amount)) ||
    !(order.quoted_by === null || typeof order.quoted_by === "string") ||
    !/^\d+$/.test(String(order.created_at)) ||
    !/^\d+$/.test(String(order.deadline_ns)) ||
    !(order.claimed_at === undefined || order.claimed_at === null ||
      (typeof order.claimed_at === "string" && /^\d+$/.test(order.claimed_at))) ||
    !(order.sent_at === null || /^\d+$/.test(String(order.sent_at)))) {
    throw new Error("Invalid escrow order view");
  }
  return {
    id,
    kind: order.kind,
    status: order.status,
    spec_hash: String(order.spec_hash),
    fulfiller: order.fulfiller as string | null,
    pay_amount: String(order.pay_amount),
    quoted_by: order.quoted_by as string | null,
    created_at: String(order.created_at),
    deadline_ns: String(order.deadline_ns),
    ...(order.claimed_at === undefined ? {} : {
      claimed_at: order.claimed_at === null ? null : String(order.claimed_at),
    }),
    sent_at: order.sent_at === null ? null : String(order.sent_at),
  };
}

export class ShopperEscrowRpc {
  private kindsCache?: Promise<Record<string, ShopperKindConfig>>;

  constructor(
    private readonly http: typeof fetch = fetch,
    private readonly url = process.env.NEAR_RPC_URL || DEFAULT_RPC_URL,
    private readonly contract = process.env.SHOPPER_ESCROW_CONTRACT || DEFAULT_ESCROW_CONTRACT,
  ) {}

  async getOrder(id: string): Promise<EscrowOrder | null> {
    const parsed = await this.view("get_order", { id });
    return parsed === null ? null : validOrder(parsed, id);
  }

  async getKinds(): Promise<Record<string, ShopperKindConfig>> {
    const parsed = await this.view("get_kinds", {});
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid escrow kind view");
    }
    const kinds = parsed as Record<string, Record<string, unknown>>;
    const result: Record<string, ShopperKindConfig> = {};
    for (const [kind, config] of Object.entries(kinds)) {
      if (!config || typeof config !== "object" ||
        !/^\d+$/.test(String(config.proof_timeout_ns)) ||
        !(config.claim_timeout_ns === undefined ||
          (typeof config.claim_timeout_ns === "string" &&
            /^\d+$/.test(config.claim_timeout_ns)))) {
        throw new Error("Invalid escrow kind view");
      }
      result[kind] = {
        proof_timeout_ns: String(config.proof_timeout_ns),
        ...(config.claim_timeout_ns === undefined ? {} : {
          claim_timeout_ns: String(config.claim_timeout_ns),
        }),
      };
    }
    return result;
  }

  async getClaimTimeoutNs(kind: string): Promise<string | null> {
    if (!this.kindsCache) {
      this.kindsCache = this.getKinds().catch((error) => {
        this.kindsCache = undefined;
        throw error;
      });
    }
    return (await this.kindsCache)[kind]?.claim_timeout_ns ?? null;
  }

  private async view(method: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await fetchWithTimeout(this.http, this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "shopper-get-order",
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: this.contract,
          method_name: method,
          args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
        },
      }),
    });
    if (!response.ok) throw new HttpError(response.status);
    const payload = await responseJson<{
      error?: unknown;
      result?: { result?: unknown };
    }>(response);
    if (payload.error || !Array.isArray(payload.result?.result) ||
      !payload.result.result.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      throw new Error("Invalid NEAR RPC view result");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(payload.result.result).toString("utf8"));
    } catch {
      throw new Error("Invalid NEAR RPC view result");
    }
    return parsed;
  }
}
