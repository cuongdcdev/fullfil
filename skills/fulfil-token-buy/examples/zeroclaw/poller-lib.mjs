export function deliveryEvidence(output, report, orderId) {
  if (report?.result === "paid") return true;
  if (report?.result !== "skipped" && Array.isArray(report?.tx_hashes) &&
      report.tx_hashes.some((hash) => typeof hash === "string" && hash.length > 0)) return true;

  const text = typeof output === "string" ? output : "";
  for (const line of text.split("\n")) {
    const candidate = line.trim().replace(/^`+|`+$/g, "");
    try {
      const value = JSON.parse(candidate);
      if (value?.ok === true && typeof value.tx_hash === "string" && value.tx_hash &&
          typeof value.receiver === "string" &&
          Object.hasOwn(value, "storage_deposit") &&
          (!orderId || value.order_id === orderId)) return true;
    } catch {
      // Most agent output is prose or a tool transcript, not standalone JSON.
    }
  }

  if (!orderId) return false;
  const escapedId = orderId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:fulfil-agent\\.mjs\\s+)?deliver\\s+${escapedId}(?![A-Za-z0-9_-])`, "i").test(text);
}

export function shouldAutoRelease({ run, status, account, deliveryEvidence: evidence }) {
  if (!status?.ok || status.status !== "claimed" || status.fulfiller !== account ||
      status.delivery_tx_hash) return false;
  if (evidence ?? deliveryEvidence(run?.output, run?.report, status.order_id)) return false;
  if (run?.output_truncated) return false;
  return run?.timed_out === true || run?.exit_code !== 0 || run?.report?.result !== "paid";
}

export function shouldWithdraw(balances, thresholdBaseUnits) {
  if (!balances?.ok) return false;
  try {
    const wallet = BigInt(balances.wallet_usdc);
    const intents = BigInt(balances.intents_usdc);
    const threshold = BigInt(thresholdBaseUnits);
    return wallet >= 0n && intents > 0n && threshold >= 0n && wallet < threshold;
  } catch {
    return false;
  }
}
