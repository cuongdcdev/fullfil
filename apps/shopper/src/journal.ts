import { closeSync, fchmodSync, fstatSync, fsyncSync, mkdirSync, openSync, writeSync,
  constants } from "node:fs";
import { dirname, join } from "node:path";
import { safeCycleStage, safeDiagnosticCode, type CycleStage } from "./diagnostics";
import type { OrderState, Phase } from "./state";

export type JournalInput = {
  order_id: string;
  from_phase?: Phase | null;
  to_phase?: Phase | null;
  stage: CycleStage;
  state?: OrderState;
  error_code?: string | null;
};

export type Journal = { record(input: JournalInput): void };

const safeId = /^[A-Za-z0-9_.:-]{1,160}$/;
const safeAmount = /^\d{1,40}$/;
const phases = new Set<Phase>([
  "claiming", "claimed", "spec_fetched", "creating", "cr_created", "paying",
  "paid_submitted", "delivered", "proof_uploaded", "proof_submitted",
  "releasing", "released", "failed", "uncertain",
]);

function identifier(value: unknown): string | null {
  return typeof value === "string" && safeId.test(value) ? value : null;
}

function amount(value: unknown): string | null {
  return typeof value === "string" && safeAmount.test(value) ? value : null;
}

function phase(value: unknown): Phase | null {
  return typeof value === "string" && phases.has(value as Phase) ? value as Phase : null;
}

// Copy each permitted field explicitly. Never serialize or spread OrderState.
export function serializeJournalEvent(input: JournalInput, clock: () => number = Date.now): string {
  const orderId = identifier(input.order_id);
  if (!orderId) throw new Error("Invalid journal order ID");
  const state = input.state;
  return JSON.stringify({
    ts: new Date(clock()).toISOString(),
    order_id: orderId,
    from_phase: phase(input.from_phase),
    to_phase: phase(input.to_phase),
    stage: safeCycleStage(input.stage),
    cr_order_id: identifier(state?.cr_order_id),
    deposit_address: identifier(state?.deposit_address),
    amount_in: amount(state?.amount_in),
    tx_hash: identifier(state?.tx_hash),
    balance_before: amount(state?.balance_before_payment),
    balance_after: amount(state?.balance_after_payment),
    error_code: input.error_code == null ? null : safeDiagnosticCode(input.error_code),
  });
}

export class FileJournal implements Journal {
  readonly path: string;

  constructor(statePath: string, private readonly clock: () => number = Date.now) {
    this.path = join(dirname(statePath), "shopper-events.jsonl");
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const fd = openSync(this.path,
      constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
    try {
      if (!fstatSync(fd).isFile()) throw new Error("Journal is not a regular file");
      fchmodSync(fd, 0o600);
    } finally {
      closeSync(fd);
    }
  }

  record(input: JournalInput): void {
    const line = `${serializeJournalEvent(input, this.clock)}\n`;
    const fd = openSync(this.path,
      constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW);
    try {
      if (!fstatSync(fd).isFile()) throw new Error("Journal is not a regular file");
      fchmodSync(fd, 0o600);
      const bytes = Buffer.from(line);
      let written = 0;
      while (written < bytes.length) {
        const count = writeSync(fd, bytes, written, bytes.length - written);
        if (count <= 0) throw new Error("Journal append failed");
        written += count;
      }
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
}
