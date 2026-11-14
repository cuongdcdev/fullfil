import { describe, expect, it } from "vitest";
import { bankTransferSpec, canonicalJson, cryptorefillsSpec, inPersonSpec, isNearAccountId, normalizeBeneficiary, sha256Hex, specHash, tokenBuySpec } from "./spec";
import beneficiaryVectors from "./beneficiary-vectors.json";

describe("order specs", () => {
  it("matches the shared beneficiary vectors", () => {
    for (const vector of beneficiaryVectors) {
      const normalize = () => normalizeBeneficiary(vector.input, vector.delivery_type as "by_phone" | "by_email");
      if (vector.normalized === null) {
        expect(normalize, vector.input).toThrow();
      } else {
        expect(normalize(), vector.input).toBe(vector.normalized);
      }
    }
  });
  it("sorts recursively and rejects fractional numbers", () => {
    expect(canonicalJson({ z: [{ b: 2, a: 1 }], a: "x" })).toBe('{"a":"x","z":[{"a":1,"b":2}]}');
    expect(() => canonicalJson({ x: 1.5 })).toThrow("integer");
    expect(specHash({ b: 2, a: 1 })).toBe(sha256Hex('{"a":1,"b":2}'));
  });
  it("normalizes beneficiaries and builds fixed and range specs", () => {
    expect(normalizeBeneficiary(" BUYER@Example.com ", "by_email")).toBe("buyer@example.com");
    expect(normalizeBeneficiary("+84900000001", "by_phone")).toBe("+84900000001");
    expect(() => normalizeBeneficiary("84900000001", "by_phone")).toThrow();
    const fixed = cryptorefillsSpec({ beneficiary: "+84900000001", brand_name: "Synthetic Mobile",
      country: "VN", delivery_type: "by_phone", denomination: "20000 VND", salt: "a".repeat(32) });
    expect(fixed.product_value).toBe("");
    expect(fixed.beneficiary_hash).toBe(sha256Hex(`${"a".repeat(32)}:+84900000001`));
    const range = cryptorefillsSpec({ beneficiary: " BUYER@Example.com ", brand_name: "Synthetic Card",
      country: "VN", delivery_type: "by_email", product_value: "10", salt: "b".repeat(32) });
    expect(range.denomination).toBe("");
    expect(range.beneficiary_hash).toBe(sha256Hex(`${"b".repeat(32)}:buyer@example.com`));
  });
  it("builds the exact bank spec", () => {
    expect(canonicalJson(bankTransferSpec(10000, "a".repeat(64)))).toBe(
      `{"amount":"10000","bank":"vpbank","country":"VN","currency":"VND","merchant_hash":"${"a".repeat(64)}","v":1}`);
  });
  it("builds a bounded canonical in-person spec", () => {
    const input = { area: "Da Nang", delivery_hash: "a".repeat(64), item_desc: "A book", price: "1000000" };
    expect(canonicalJson(inPersonSpec(input))).toBe(
      `{"area":"Da Nang","delivery_hash":"${"a".repeat(64)}","item_desc":"A book","price":"1000000","v":1}`,
    );
    expect(() => inPersonSpec({ ...input, delivery_hash: "A".repeat(64) })).toThrow();
    expect(inPersonSpec({ ...input, area: " A book\n" }).area).toBe("A book");
    expect(inPersonSpec({ ...input, area: "  danang \n  street " }).area).toBe("danang street");
    expect(() => inPersonSpec({ ...input, area: "  \n" })).toThrow("Area is required");
    expect(() => inPersonSpec({ ...input, area: "x".repeat(81) })).toThrow("Area is too long, keep it under 80 characters");
    expect(() => inPersonSpec({ ...input, item_desc: "x".repeat(161) })).toThrow();
    expect(() => inPersonSpec({ ...input, price: "999999" })).toThrow();
    expect(() => inPersonSpec({ ...input, price: "20000001" })).toThrow();
    expect(() => inPersonSpec({ ...input, price: 1_000_000 as unknown as string })).toThrow();
  });
  it("builds and hashes the exact token-buy spec", () => {
    const input = { amount_out: "340282366920938463463374607431768211455", receiver: "buyer.near", token_contract: "blackdragon.tkn.near" };
    const spec = tokenBuySpec(input);
    const canonical = '{"amount_out":"340282366920938463463374607431768211455","receiver":"buyer.near","token_contract":"blackdragon.tkn.near","v":1}';
    expect(canonicalJson(spec)).toBe(canonical);
    expect(specHash(spec)).toBe(sha256Hex(canonical));
    expect(specHash(spec)).toBe(specHash({ v: 1, token_contract: input.token_contract, receiver: input.receiver, amount_out: input.amount_out }));
    expect(tokenBuySpec({ ...input, receiver: "a".repeat(64) }).receiver).toBe("a".repeat(64));
  });
  it("rejects invalid token-buy amounts and NEAR account IDs", () => {
    const input = { amount_out: "1", receiver: "buyer.near", token_contract: "token.near" };
    for (const amount_out of ["", "0", "00", "01", "-1", "+1", "1.0", "1e3", " 1", "1 ", "340282366920938463463374607431768211456", "9".repeat(10_000)]) {
      expect(() => tokenBuySpec({ ...input, amount_out }), amount_out).toThrow();
    }
    expect(() => tokenBuySpec({ ...input, amount_out: 1 as unknown as string })).toThrow();
    for (const id of ["", "a", "A.near", "a..near", ".near", "near.", "a--b.near", "a__b.near", "a.-b", "a-.b", "a@near", "a".repeat(65), "A".repeat(64)]) {
      expect(isNearAccountId(id), id).toBe(false);
      expect(() => tokenBuySpec({ ...input, receiver: id }), id).toThrow();
      expect(() => tokenBuySpec({ ...input, token_contract: id }), id).toThrow();
    }
    for (const id of ["aa", "a-b.near", "a_b.near", "0".repeat(64)]) {
      expect(isNearAccountId(id), id).toBe(true);
    }
  });
});
