import { describe, expect, it } from "vitest";
import { resolveMapping } from "./mappings";

describe("token mapping resolution", () => {
  it("maps a known (chain, address) exactly", () => {
    const r = resolveMapping(1, "0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b", "syrupUSDC");
    expect(r.mappingStatus).toBe("mapped");
    expect(r.pharosStablecoinId).toBe("syrupusdc-maple");
    expect(r.mappingConfidence).toBe("manual");
    expect(r.decimals).toBe(6);
  });

  it("is case-insensitive on the address", () => {
    const r = resolveMapping(1, "0x80AC24AA929EAF5013F6436CDA2A7BA190F5CC0B", "syrupUSDC");
    expect(r.pharosStablecoinId).toBe("syrupusdc-maple");
  });

  it("resolves a renamed symbol on a known address (address is authoritative)", () => {
    const r = resolveMapping(1, "0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b", "TOTALLY_RENAMED");
    expect(r.mappingStatus).toBe("mapped");
    expect(r.pharosStablecoinId).toBe("syrupusdc-maple");
  });

  it("flags a conflict for a known symbol on an unexpected same-chain address", () => {
    const r = resolveMapping(1, "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", "syrupUSDC");
    expect(r.mappingStatus).toBe("conflict");
    expect(r.pharosStablecoinId).toBeNull();
  });

  it("returns unmapped when neither address nor symbol is known", () => {
    const r = resolveMapping(1, "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", "mystUSD");
    expect(r.mappingStatus).toBe("unmapped");
    expect(r.pharosStablecoinId).toBeNull();
    expect(r.decimals).toBeNull();
  });

  it("provides authoritative decimals for eEARN (6, not the 18 default)", () => {
    const r = resolveMapping(1, "0x9be9294722f8aad37b11a9792be2c782182cafa2", "eEARN");
    expect(r.decimals).toBe(6);
  });
});
