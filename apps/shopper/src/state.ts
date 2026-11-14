import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import type { StateLock } from "./lock";

export type Phase = "claiming" | "claimed" | "spec_fetched" | "creating" | "cr_created" |
  "paying" | "paid_submitted" | "delivered" | "proof_uploaded" | "proof_submitted" |
  "releasing" | "released" | "failed" | "uncertain";
export type OrderState = {
  phase: Phase;
  spec?: string;
  beneficiary?: string;
  buyer_email?: string;
  cr_order_id?: string;
  cr_order_token?: string;
  wallet_address?: string;
  coin_amount?: string;
  deposit_address?: string;
  amount_in?: string;
  tx_hash?: string;
  proof_sha256?: string;
  started_at?: number;
  cr_created_at?: number;
  paid_at?: number;
  swap_succeeded_at?: number;
  sent_marked_at?: number;
  sent_blocked_alerted_at?: number;
  delivery_started_at?: number;
  delivery_failed?: true;
  balance_before_payment?: string;
  balance_after_payment?: string;
};

export class StateStore {
  private states: Record<string, OrderState>;

  constructor(readonly path: string, private readonly lock?: StateLock) {
    if (lock) {
      lock.assertHeld(path);
      mkdirSync(dirname(path), { recursive: true });
      if (!existsSync(path)) {
        writeFileSync(path, "{}", { mode: 0o600, flag: "wx" });
      }
      chmodSync(path, 0o600);
    }
    this.states = JSON.parse(readFileSync(path, "utf8")) as Record<string, OrderState>;
  }

  get(id: string): OrderState | undefined {
    return this.states[id];
  }

  entries(): [string, OrderState][] {
    return Object.entries(this.states);
  }

  set(id: string, state: OrderState): void {
    if (!this.lock) throw new Error("Shopper state lock required");
    this.lock.assertHeld(this.path);
    const latest = JSON.parse(readFileSync(this.path, "utf8")) as Record<string, OrderState>;
    const merged = { ...latest, [id]: state };
    const temporary = `${this.path}.${randomBytes(8).toString("hex")}.tmp`;
    writeFileSync(temporary, JSON.stringify(merged), { mode: 0o600, flag: "wx" });
    chmodSync(temporary, 0o600);
    renameSync(temporary, this.path);
    chmodSync(this.path, 0o600);
    this.states = merged;
  }
}
