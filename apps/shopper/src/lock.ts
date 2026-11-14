import { randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

type LockContents = {
  pid: number | null;
  token: string | null;
  bootId: string | null;
  starttime: string | null;
  device: number;
  inode: number;
  mtimeMs: number;
  size: number;
};

export type ProcReaders = {
  bootId: () => string | null;
  processStartTime: (pid: number) => string | null;
};

export function parseProcessStartTime(stat: string): string | null {
  // Field 2 (comm) is parenthesized and may itself contain spaces or ')'.
  const endOfComm = stat.lastIndexOf(")");
  if (endOfComm < 0) return null;
  const fields = stat.slice(endOfComm + 1).trim().split(/\s+/);
  const starttime = fields[19]; // Field 22, counting the state field as field 3.
  return starttime && /^\d+$/.test(starttime) ? starttime : null;
}

const defaultProcReaders: ProcReaders = {
  bootId: () => {
    try {
      return readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim() || null;
    } catch {
      return null;
    }
  },
  processStartTime: (pid) => {
    try {
      return parseProcessStartTime(readFileSync(`/proc/${pid}/stat`, "utf8"));
    } catch {
      return null;
    }
  },
};

export class ShopperLockHeldError extends Error {
  constructor(readonly pid: number) {
    super(`Shopper bot is running (pid ${pid}); stop the bot first`);
    this.name = "ShopperLockHeldError";
  }
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

function readLock(path: string): LockContents {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error("Invalid shopper state lock");
    const text = readFileSync(fd, "utf8").trim();
    const metadata = { device: stat.dev, inode: stat.ino,
      mtimeMs: stat.mtimeMs, size: stat.size };
    try {
      const parsed: unknown = /^\d+$/.test(text)
        ? { pid: Number(text) }
        : JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid shopper state lock");
      }
      const value = parsed as Record<string, unknown>;
      const { pid } = value;
      const token = value.token ?? null;
      const bootId = value.boot_id ?? null;
      const starttime = value.starttime ?? null;
      if (!Number.isSafeInteger(pid) || (pid as number) < 1 ||
        !(token === null || typeof token === "string") ||
        !(bootId === null || typeof bootId === "string") ||
        !(starttime === null || (typeof starttime === "string" && /^\d+$/.test(starttime)))) {
        throw new Error("Invalid shopper state lock");
      }
      return { pid: pid as number, token, bootId, starttime, ...metadata };
    } catch {
      // A newly created lock can be empty while its owner writes it.
      return { pid: null, token: null, bootId: null, starttime: null, ...metadata };
    }
  } finally {
    closeSync(fd);
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException)?.code !== "ESRCH";
  }
}

export class StateLock {
  readonly path: string;
  private released = false;

  private constructor(
    readonly statePath: string,
    readonly pid: number,
    private readonly token: string,
    private readonly device: number,
    private readonly inode: number,
  ) {
    this.path = `${statePath}.lock`;
  }

  static acquire(statePath: string, readers: ProcReaders = defaultProcReaders): StateLock {
    const absolute = resolve(statePath);
    const path = `${absolute}.lock`;
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const token = randomBytes(16).toString("hex");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let fd: number;
      try {
        fd = openSync(path,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") throw error;
        let observed: LockContents;
        try {
          observed = readLock(path);
        } catch (readError) {
          if (isMissing(readError)) continue;
          throw readError;
        }
        if (observed.pid === null) {
          if (Date.now() - observed.mtimeMs <= 30_000) {
            throw new Error("Shopper state lock is being created; retry later");
          }
        } else {
          const currentBootId = readers.bootId();
          const bootChanged = observed.bootId !== null && currentBootId !== null &&
            observed.bootId !== currentBootId;
          const alive = isAlive(observed.pid);
          const currentStarttime = alive && observed.starttime !== null
            ? readers.processStartTime(observed.pid) : null;
          const starttimeChanged = observed.starttime !== null && currentStarttime !== null &&
            observed.starttime !== currentStarttime;
          if (!bootChanged && alive && !starttimeChanged) {
            throw new ShopperLockHeldError(observed.pid);
          }
        }
        if (attempt > 0) throw new Error("Shopper state lock could not be acquired");
        const stalePath = `${path}.stale.${process.pid}.${token}`;
        try {
          renameSync(path, stalePath);
        } catch (renameError) {
          if (isMissing(renameError)) continue;
          throw renameError;
        }
        const moved = readLock(stalePath);
        if (moved.device !== observed.device || moved.inode !== observed.inode ||
          moved.mtimeMs !== observed.mtimeMs || moved.size !== observed.size ||
          moved.pid !== observed.pid || moved.token !== observed.token ||
          moved.bootId !== observed.bootId || moved.starttime !== observed.starttime) {
          try {
            linkSync(stalePath, path);
          } catch (linkError) {
            if ((linkError as NodeJS.ErrnoException)?.code !== "EEXIST") throw linkError;
          }
          unlinkSync(stalePath);
          throw new Error("Shopper state lock changed during acquisition");
        }
        unlinkSync(stalePath);
        continue;
      }
      try {
        const contents = Buffer.from(JSON.stringify({
          pid: process.pid,
          token,
          boot_id: readers.bootId(),
          starttime: readers.processStartTime(process.pid),
          started_at: new Date().toISOString(),
        }));
        fchmodSync(fd, 0o600);
        let written = 0;
        while (written < contents.length) {
          const count = writeSync(fd, contents, written, contents.length - written);
          if (count <= 0) throw new Error("Shopper state lock write failed");
          written += count;
        }
        fsyncSync(fd);
        const stat = fstatSync(fd);
        return new StateLock(absolute, process.pid, token, stat.dev, stat.ino);
      } catch (error) {
        const created = fstatSync(fd);
        try {
          const current = lstatSync(path);
          if (current.dev === created.dev && current.ino === created.ino) unlinkSync(path);
        } catch (cleanupError) {
          if (!isMissing(cleanupError)) throw cleanupError;
        }
        throw error;
      } finally {
        closeSync(fd);
      }
    }
    throw new Error("Shopper state lock could not be acquired");
  }

  assertHeld(statePath: string): void {
    if (this.released || process.pid !== this.pid || resolve(statePath) !== this.statePath) {
      throw new Error("Shopper state lock required");
    }
    let current: LockContents;
    try {
      current = readLock(this.path);
    } catch {
      throw new Error("Shopper state lock required");
    }
    if (current.pid !== this.pid || current.token !== this.token ||
      current.device !== this.device || current.inode !== this.inode) {
      throw new Error("Shopper state lock required");
    }
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    try {
      const current = readLock(this.path);
      if (current.pid === this.pid && current.token === this.token &&
        current.device === this.device && current.inode === this.inode) {
        unlinkSync(this.path);
      }
    } catch {
      // A removed or replaced lock must not be removed by this holder.
    }
  }
}
