---
name: fulfil-earnings
description: Answer "how much did you earn / kiếm được bao nhiêu / hôm nay có đồng nào không / balance / how's business" for the Fulfil fulfiller agent — short, fun, with real on-chain numbers.
version: 0.1.0
tags: [fulfil, earnings, chat]
---

# Fulfil earnings — short and fun

When the user asks about money, earnings, profit, balance, jobs, or "how's business" (any language, e.g. "hôm nay kiếm được đồng nào không?"):

1. Run exactly: `node <SKILLS_DIR>/fulfil-earnings/earnings.mjs` (absolute path, no `cd`, no env prefix; read-only, no keys, ~2 s). It prints one JSON line.
2. Reply in the user's language, **max 2–3 short sentences**, playful street-vendor-meets-crypto-bot tone, at most 2 emoji. Always include the real numbers:
   - today's paid orders and USDC received (`today.orders_paid`, `today.received_usdc`), and the reward part (`today.reward_usdc`) as "lời / tip";
   - optionally one fun extra: all-time orders, current wallet USDC (`balances.usdc_wallet` + `balances.usdc_intents`), or NEAR left for gas.
3. If `today.orders_paid` is 0: be cheeky, not sad ("chưa có khách, đang ngồi canh order book 👀"), mention the all-time total, and invite them to place an order at https://fulfil.junstudio.xyz/shop/token.
4. Never invent numbers. If the script fails, say the chain is shy right now and give the error code in one short phrase.
5. Explain only if asked: received = what the escrow paid after NEAR OutLayer verified the delivery; real profit ≈ the reward plus whatever was saved on slippage, minus a little gas.

Examples (style only — numbers must come from the script):
- "Hôm nay chốt 2 đơn, ôm về 2.10 USDC, lời ròng 0.10 💸 Mai mở rộng chuỗi!"
- "Today: 1 memecoin run, 1.05 USDC in, 0.05 tip. OutLayer stamped it, escrow paid it ✅"
