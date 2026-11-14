/**
 * Curated mainnet evidence for the judges section. Every transaction hash below is a full hash copied from
 * docs/pm/E2E_LOG.md and was checked to exist via the NearBlocks API. Entries whose log cells only have a
 * truncated hash carry no `hash`, and link to the escrow account page instead.
 */
export type EvidenceRun = { id: string; title: string; detail: string; kind: string; hash?: string; hashLabel?: string };
export type EvidenceAttack = { title: string; plain: string; result: string; hash?: string };

export const earlierRuns: EvidenceRun[] = [
  {
    id: "FUL-892B4EF7", kind: "bank_transfer", title: "First end-to-end run: a real VietQR bank transfer",
    detail: "A real 10,000 VND transfer proved by a bank email. The OutLayer TEE check took 3.96 s, then escrow paid out.",
    hash: "9duGzaUhpxuWhenTJAaX4s4EeaJbRTKyvAgZr5RTskGy", hashLabel: "Proof and payout",
  },
  {
    id: "FUL-9F6386AD", kind: "cryptorefills_topup", title: "A real Viettel phone top-up bought by a shopper bot",
    detail: "The bot bought a 20,000 VND top-up from Cryptorefills with its own funds. Funded to paid in 84 s.",
    hash: "Yzuj2n17uzaxyJRmH8Qjr2Nsug1uJ3fXcKeL3mf1YG2", hashLabel: "Order funded",
  },
  {
    id: "FUL-EF73668E", kind: "in_person", title: "In-person delivery confirmed with a QR receipt",
    detail: "The escrow contract checked the QR secret itself and paid the helper in 27.7 s.",
  },
  {
    id: "FUL-E549842C", kind: "token_buy", title: "1 USDC became 685.03 SHITZU",
    detail: "An agent bought the token and OutLayer read the chain and verified it in about 11.7 s. Paid on the first attempt.",
    hash: "CMGGEJpva9972qnhzAd8TVh1iuMFk6f7it9JrBAhYQD1", hashLabel: "Verification and payout",
  },
  {
    id: "FUL-D60FC569", kind: "token_buy", title: "An AI agent finished an order using only the skill",
    detail: "An agent followed the public skill and its CLI, bought the token, delivered it and was paid. About 2.7 minutes in total.",
    hash: "6Jp4bmmp81cP3DcD996KRaTfGdPihum65EmGHEyVyN5g", hashLabel: "Verification and payout",
  },
];

export const attacks: EvidenceAttack[] = [
  { title: "A rogue claim inside the exclusive window", plain: "Another helper tried to grab an order while the quoted shopper bot still had it reserved.",
    result: "rejected: quote exclusive", hash: "9niicRqMR4Ryknog2trs7uB8jF95kFyrvuibmysVuVaQ" },
  { title: "Cancelling while a helper has claimed", plain: "The buyer tried to pull the money back after someone started the job.",
    result: "rejected: not cancellable", hash: "38cLhfTX7qPepVKiWaZL7xhaa7bkVMyd81zUpyKzjyeX" },
  { title: "A tampered order spec", plain: "A fulfiller changed the order details and signed the proof straight to the contract, skipping our backend.",
    result: "rejected: spec hash mismatch", hash: "3cQeEbDi54RQKP5RaTWZLLH6wqukCJpbttSrTNWGbcKK" },
  { title: "A helper who is not on the allowlist", plain: "A rogue helper tried to claim a gift-card order that only the official bot may take.",
    result: "rejected: fulfiller not allowed", hash: "H4Vvg9pzGUeKouDTGfdr52JfK3xNu46AAyxxvqdKcc9r" },
  { title: "Replaying someone else's delivered order", plain: "A fulfiller reused a real, delivered top-up as proof for a different phone number.",
    result: "rejected by the TEE: beneficiary_mismatch", hash: "ArafP2GqutSSxnus29yv711eim4mLjre5JoG2TXpLSnV" },
  { title: "Holding two claims at once", plain: "A new helper tried to run two open claims at the same time.",
    result: "rejected: claim limit" },
  { title: "Refund after the deadline", plain: "An order nobody finished. After the deadline anyone can trigger the refund, and the buyer gets everything back.",
    result: "refunded: permissionless expire", hash: "Gw8N2NEk7bN446NZAzX3Z3jKVYDWPqbA3C4eWxs45cxA" },
];
