import { FulfilApiClient, IntentSigner } from "./api";
import { CryptorefillsClient } from "./cryptorefills";
import { OneClickClient } from "./oneclick";
import { runOnce } from "./loop";
import { StateStore } from "./state";
import { shopperLimits } from "./limits";
import { ShopperEscrowRpc } from "./rpc";
import { describeCycleError, StageError } from "./diagnostics";
import { FileJournal } from "./journal";
import { WebhookAlerter } from "./alerts";
import { ShopperLockHeldError, StateLock } from "./lock";

function installLockCleanup(lock: StateLock): () => void {
  const onExit = () => lock.release();
  const onInterrupt = () => {
    lock.release();
    process.exit(130);
  };
  const onTerminate = () => {
    lock.release();
    process.exit(143);
  };
  process.once("exit", onExit);
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  return () => {
    process.removeListener("exit", onExit);
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
    lock.release();
  };
}

async function main(): Promise<void> {
  const accountId = process.env.SHOPPER_ACCOUNT_ID;
  const privateKey = process.env.SHOPPER_INTENTS_PRIVATE_KEY;
  const baseUrl = process.env.FULFIL_API_URL;
  if (!accountId || !privateKey || !baseUrl) throw new Error("Missing shopper configuration");
  const api = new FulfilApiClient(baseUrl, accountId, new IntentSigner(privateKey));
  const statePath = process.env.SHOPPER_STATE_FILE || "./data/shopper-state.json";
  const limits = shopperLimits(
    process.env.SHOPPER_MAX_ORDER_USDC, process.env.SHOPPER_RESERVE_USDC,
    process.env.SHOPPER_MIN_TIME_LEFT_MS);
  const lock = StateLock.acquire(statePath);
  const cleanup = installLockCleanup(lock);
  try {
    const clients = {
      api,
      escrow: new ShopperEscrowRpc(),
      cryptorefills: new CryptorefillsClient(),
      oneClick: new OneClickClient(),
      store: new StateStore(statePath, lock),
      journal: new FileJournal(statePath),
      alerter: new WebhookAlerter(process.env.SHOPPER_ALERT_WEBHOOK),
      accountId,
      ...limits,
      readBalance: () => api.readIntentsBalance(),
    };
    const interval = Number(process.env.SHOPPER_POLL_MS || 10_000);
    if (!Number.isSafeInteger(interval) || interval < 1_000) {
      throw new Error("Invalid shopper poll interval");
    }
    await api.login();
    while (true) {
      try {
        await runOnce(clients);
      } catch (error) {
        console.error(describeCycleError(error));
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(error instanceof ShopperLockHeldError ? error.message :
    describeCycleError(new StageError("startup", error)));
  process.exitCode = 1;
});
