import { describe, expect, it } from "vitest";
import { merchantHash, normalizeAccount } from "./merchant-hash";

describe("merchant account hashing", () => {
  const vectors = [
    [
      " 0000 1234.567-89 ",
      "0000123456789",
      "50ebbc094dfa0bcccdd67d4c216eeab9fed26448b1c698c9ecfba7a7bda1d345",
    ],
    [
      " a b.c-123 ",
      "ABC123",
      "e0bebd22819993425814866b62701e2919ea26f1370499c1037b53b9d49c2c8a",
    ],
    [
      " A\u0085B ",
      "AB",
      "38164fbd17603d73f696b8b4d72664d735bb6a7c88577687fd2ae33fd6964153",
    ],
  ] as const;

  for (const [raw, normalized, hash] of vectors) {
    it(`normalizes and hashes ${normalized}`, () => {
      expect(normalizeAccount(raw)).toBe(normalized);
      expect(merchantHash(raw)).toBe(hash);
    });
  }
});
