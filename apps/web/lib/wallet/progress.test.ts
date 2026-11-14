import { afterEach, describe, expect, it } from "vitest";
import { beginWalletProgress, walletPhase } from "./progress";

afterEach(() => {
  beginWalletProgress().finish();
});

describe("wallet progress presentation state", () => {
  it("moves from signing to confirming and always returns to idle", () => {
    const progress = beginWalletProgress();
    expect(walletPhase()).toBe("signing");

    progress.update("confirming");
    expect(walletPhase()).toBe("confirming");

    progress.finish();
    expect(walletPhase()).toBe("idle");
  });

  it("does not let an older action hide a newer action", () => {
    const first = beginWalletProgress();
    const second = beginWalletProgress();

    first.finish();
    expect(walletPhase()).toBe("signing");

    second.update("confirming");
    expect(walletPhase()).toBe("confirming");
    second.finish();
    expect(walletPhase()).toBe("idle");
  });
});
