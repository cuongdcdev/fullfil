import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, statSync, unlinkSync, utimesSync,
  writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseProcessStartTime, ShopperLockHeldError, StateLock,
  type ProcReaders } from "./lock";
import { StateStore } from "./state";
import { openRecoveryState } from "./recover";

function statePath(): string {
  return join(mkdtempSync(join(tmpdir(), "shopper-lock-")), "state.json");
}

const currentProcess: ProcReaders = {
  bootId: () => "boot-current",
  processStartTime: () => "200",
};

function existingLock(path: string, bootId: string, starttime: string): void {
  writeFileSync(`${path}.lock`, JSON.stringify({
    pid: process.pid, token: "old", boot_id: bootId, starttime,
  }), { mode: 0o600 });
}

describe("shopper state lock", () => {
  it("creates an exclusive mode-0600 lock and refuses a second live holder", () => {
    const path = statePath();
    const lock = StateLock.acquire(path, currentProcess);
    try {
      expect(statSync(lock.path).mode & 0o777).toBe(0o600);
      expect(JSON.parse(readFileSync(lock.path, "utf8"))).toMatchObject({
        pid: process.pid, boot_id: "boot-current", starttime: "200",
      });
      expect(() => StateLock.acquire(path, currentProcess)).toThrow(ShopperLockHeldError);
      expect(() => StateLock.acquire(path, currentProcess)).toThrow(
        `Shopper bot is running (pid ${process.pid}); stop the bot first`);
    } finally {
      lock.release();
    }
    expect(existsSync(lock.path)).toBe(false);
  });

  it("parses starttime after the last parenthesis in a complex process name", () => {
    const fields = ["S", ...Array.from({ length: 18 }, (_, index) => String(index + 1)), "424242"];
    expect(parseProcessStartTime(`123 (name with ) and ( spaces) ${fields.join(" ")}`))
      .toBe("424242");
    expect(parseProcessStartTime("malformed stat")).toBeNull();
  });

  it("takes over a live pid from a previous boot", () => {
    const path = statePath();
    existingLock(path, "boot-previous", "200");
    const lock = StateLock.acquire(path, currentProcess);
    try {
      expect(JSON.parse(readFileSync(lock.path, "utf8")).boot_id).toBe("boot-current");
    } finally {
      lock.release();
    }
  });

  it("takes over a reused live pid with a different process starttime", () => {
    const path = statePath();
    existingLock(path, "boot-current", "100");
    const lock = StateLock.acquire(path, currentProcess);
    try {
      expect(JSON.parse(readFileSync(lock.path, "utf8")).starttime).toBe("200");
    } finally {
      lock.release();
    }
  });

  it("refuses a matching live pid and process starttime", () => {
    const path = statePath();
    existingLock(path, "boot-current", "200");
    expect(() => StateLock.acquire(path, currentProcess)).toThrow(ShopperLockHeldError);
  });

  it("refuses a young corrupt lock while a starter may be writing it", () => {
    const path = statePath();
    writeFileSync(`${path}.lock`, "{", { mode: 0o600 });
    expect(() => StateLock.acquire(path, currentProcess))
      .toThrow("Shopper state lock is being created; retry later");
    expect(readFileSync(`${path}.lock`, "utf8")).toBe("{");
  });

  it("takes over a corrupt lock older than 30 seconds", () => {
    const path = statePath();
    writeFileSync(`${path}.lock`, "{", { mode: 0o600 });
    const old = new Date(Date.now() - 31_000);
    utimesSync(`${path}.lock`, old, old);
    const lock = StateLock.acquire(path, currentProcess);
    try {
      expect(JSON.parse(readFileSync(lock.path, "utf8")).pid).toBe(process.pid);
    } finally {
      lock.release();
    }
  });

  it("takes over a lock whose pid is dead", () => {
    const path = statePath();
    writeFileSync(`${path}.lock`, JSON.stringify({ pid: 2_147_483_647, token: "old" }),
      { mode: 0o600 });
    const lock = StateLock.acquire(path);
    try {
      expect(JSON.parse(readFileSync(lock.path, "utf8")).pid).toBe(process.pid);
    } finally {
      lock.release();
    }
  });

  it("keeps a legacy live-pid lock when proc data is unavailable", () => {
    const path = statePath();
    writeFileSync(`${path}.lock`, JSON.stringify({ pid: process.pid, token: "legacy" }),
      { mode: 0o600 });
    expect(() => StateLock.acquire(path, {
      bootId: () => null,
      processStartTime: () => null,
    })).toThrow(ShopperLockHeldError);
  });

  it("release leaves a replaced lock in place", () => {
    const path = statePath();
    const lock = StateLock.acquire(path);
    unlinkSync(lock.path);
    writeFileSync(lock.path, JSON.stringify({ pid: process.pid, token: "replacement" }),
      { mode: 0o600 });

    lock.release();

    expect(existsSync(lock.path)).toBe(true);
    expect(JSON.parse(readFileSync(lock.path, "utf8")).token).toBe("replacement");
    unlinkSync(lock.path);
  });

  it("set merges a fresh disk snapshot and rejects writes without the lock", () => {
    const path = statePath();
    const lock = StateLock.acquire(path);
    try {
      const store = new StateStore(path, lock);
      store.set("FUL-A", { phase: "claimed" });
      writeFileSync(path, JSON.stringify({
        "FUL-A": { phase: "claimed" }, "FUL-B": { phase: "paid_submitted", tx_hash: "tx-b" },
      }), { mode: 0o600 });
      store.set("FUL-A", { phase: "paying" });
      expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
        "FUL-A": { phase: "paying" }, "FUL-B": { phase: "paid_submitted", tx_hash: "tx-b" },
      });
      expect(() => new StateStore(path).set("FUL-A", { phase: "claimed" }))
        .toThrow("Shopper state lock required");
    } finally {
      lock.release();
    }
    expect(() => new StateStore(path, lock).set("FUL-A", { phase: "claimed" }))
      .toThrow("Shopper state lock required");
  });

  it("read-only recovery does not write the state or create a lock", () => {
    const path = statePath();
    const contents = '{"FUL-A":{"phase":"uncertain"}}';
    writeFileSync(path, contents, { mode: 0o640 });
    const before = statSync(path);

    const opened = openRecoveryState(path, false);

    expect(opened.store.get("FUL-A")?.phase).toBe("uncertain");
    expect(opened.lock).toBeUndefined();
    expect(readFileSync(path, "utf8")).toBe(contents);
    expect(statSync(path).mtimeMs).toBe(before.mtimeMs);
    expect(statSync(path).mode & 0o777).toBe(0o640);
    expect(existsSync(`${path}.lock`)).toBe(false);
  });

  it("refuses proof submission while the bot holds the lock", () => {
    const path = statePath();
    const lock = StateLock.acquire(path);
    try {
      expect(() => openRecoveryState(path, true)).toThrow(
        `Shopper bot is running (pid ${process.pid}); stop the bot first`);
      writeFileSync(path, '{"FUL-A":{"phase":"uncertain"}}', { mode: 0o600 });
      expect(openRecoveryState(path, false).store.get("FUL-A")?.phase).toBe("uncertain");
    } finally {
      lock.release();
    }
  });

  it("constructing without a lock does not create a missing state file", () => {
    const path = statePath();
    expect(() => new StateStore(path)).toThrow();
    expect(existsSync(path)).toBe(false);
  });

  it("constructing without a lock does not chmod an existing state file", () => {
    const path = statePath();
    writeFileSync(path, "{}", { mode: 0o640 });
    new StateStore(path);
    expect(statSync(path).mode & 0o777).toBe(0o640);
    expect(existsSync(`${path}.lock`)).toBe(false);
  });
});
