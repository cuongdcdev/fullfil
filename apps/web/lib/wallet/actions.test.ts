import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuiltPayload } from "../v3-client";
import { V3Error, v3 } from "../v3-client";
import { beginWalletProgress, walletPhase } from "./progress";
import { WalletError } from "./types";

const mocks = vi.hoisted(() => ({
  signIntent: vi.fn(),
  currentSigner: vi.fn(),
  askEnableIntentsKey: vi.fn(),
}));

vi.mock("./index", () => ({ currentSigner: mocks.currentSigner }));
vi.mock("./intents-key", () => ({ askEnableIntentsKey: mocks.askEnableIntentsKey }));

const { signAndSubmit } = await import("./actions");

const built = (): BuiltPayload => ({
  deadline: new Date(Date.now() + 60_000).toISOString(),
  payload_to_sign: "payload",
} as BuiltPayload);

const evmSignature = {
  standard: "erc191" as const,
  payload: "payload",
  signature: "0xabc",
};

const nearSignature = {
  standard: "nep413" as const,
  payload: {
    message: "payload",
    nonce: "n",
    recipient: "r",
  },
  public_key: "ed25519:key",
  signature: "ed25519:sig",
};

beforeEach(() => {
  mocks.currentSigner.mockReturnValue({ kind: "evm", signIntent: mocks.signIntent });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  mocks.signIntent.mockReset();
  mocks.currentSigner.mockReset();
  mocks.askEnableIntentsKey.mockReset();
  beginWalletProgress().finish();
});

describe("signAndSubmit presentation state", () => {
  it("changes presentation from signing to confirming without adding a submission", async () => {
    let releaseSubmit: ((value: { status: string }) => void) | undefined;
    const submitted = new Promise<{ status: string }>((resolve) => {
      releaseSubmit = resolve;
    });
    mocks.signIntent.mockResolvedValue(evmSignature);
    vi.spyOn(v3, "submit").mockReturnValue(submitted);

    const action = signAndSubmit(built());
    await Promise.resolve();
    expect(walletPhase()).toBe("confirming");
    expect(mocks.signIntent).toHaveBeenCalledTimes(1);
    expect(v3.submit).toHaveBeenCalledTimes(1);

    if (!releaseSubmit) throw new Error("submit did not start");
    releaseSubmit({ status: "success" });
    await expect(action).resolves.toEqual({ status: "success" });
    expect(walletPhase()).toBe("idle");
    expect(mocks.signIntent).toHaveBeenCalledTimes(1);
    expect(v3.submit).toHaveBeenCalledTimes(1);
  });

  it("resets presentation state when submission fails and preserves the error", async () => {
    const failure = new V3Error("upstream_error", "Temporary failure", 502);
    mocks.signIntent.mockResolvedValue(evmSignature);
    vi.spyOn(v3, "submit").mockRejectedValue(failure);

    await expect(signAndSubmit(built())).rejects.toBe(failure);
    expect(walletPhase()).toBe("idle");
    expect(mocks.signIntent).toHaveBeenCalledTimes(1);
    expect(v3.submit).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing missing-key retry shape and returns to idle", async () => {
    mocks.currentSigner.mockReturnValue({
      kind: "near",
      signIntent: mocks.signIntent,
    });
    mocks.signIntent.mockResolvedValue(nearSignature);
    mocks.askEnableIntentsKey.mockResolvedValue(true);
    vi.spyOn(v3, "submit")
      .mockRejectedValueOnce(new V3Error("intents_key_missing", "Key is missing", 400, "ed25519:key"))
      .mockResolvedValueOnce({ status: "success" });

    await expect(signAndSubmit(built())).resolves.toEqual({ status: "success" });
    expect(mocks.askEnableIntentsKey).toHaveBeenCalledWith("ed25519:key");
    expect(mocks.signIntent).toHaveBeenCalledTimes(2);
    expect(v3.submit).toHaveBeenCalledTimes(2);
    expect(walletPhase()).toBe("idle");
  });

  it("does not submit when the person cancels in their wallet", async () => {
    const cancelled = new WalletError("You cancelled in your wallet.", true);
    mocks.signIntent.mockRejectedValue(cancelled);
    const submit = vi.spyOn(v3, "submit");

    await expect(signAndSubmit(built())).rejects.toBe(cancelled);
    expect(submit).not.toHaveBeenCalled();
    expect(walletPhase()).toBe("idle");
  });

  it("does not retry when the person declines missing-key setup", async () => {
    mocks.currentSigner.mockReturnValue({
      kind: "near",
      signIntent: mocks.signIntent,
    });
    mocks.signIntent.mockResolvedValue(nearSignature);
    mocks.askEnableIntentsKey.mockResolvedValue(false);
    const submit = vi.spyOn(v3, "submit").mockRejectedValue(
      new V3Error("intents_key_missing", "Key is missing", 400, "ed25519:key"),
    );

    await expect(signAndSubmit(built())).rejects.toBeInstanceOf(WalletError);
    expect(mocks.signIntent).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(walletPhase()).toBe("idle");
  });

  it("keeps the existing four delayed registry retries for one signed payload", async () => {
    vi.useFakeTimers();
    mocks.currentSigner.mockReturnValue({
      kind: "near",
      signIntent: mocks.signIntent,
    });
    mocks.signIntent.mockResolvedValue(nearSignature);
    mocks.askEnableIntentsKey.mockResolvedValue(true);
    const missing = new V3Error("intents_key_missing", "Key is missing", 400, "ed25519:key");
    const submit = vi.spyOn(v3, "submit")
      .mockRejectedValueOnce(missing)
      .mockRejectedValue(missing);

    const action = signAndSubmit(built());
    const rejection = action.catch((error) => error);
    await vi.runAllTimersAsync();

    await expect(rejection).resolves.toBe(missing);
    expect(mocks.signIntent).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenCalledTimes(5);
    expect(walletPhase()).toBe("idle");
  });

  it("returns to idle when no signer is available", async () => {
    const missingSigner = new WalletError("Please log in again.");
    mocks.currentSigner.mockImplementation(() => {
      throw missingSigner;
    });
    const submit = vi.spyOn(v3, "submit");

    await expect(signAndSubmit(built())).rejects.toBe(missingSigner);
    expect(mocks.signIntent).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(walletPhase()).toBe("idle");
  });
});
