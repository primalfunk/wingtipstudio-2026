import type { AmmoMode } from "./types";

export function evaluateMatch(mode: AmmoMode, ammoLabel: string, targetLabel: string): boolean {
  void mode;
  const value = evaluateArithmetic(ammoLabel);
  return value !== null && normalizeNumber(targetLabel) === normalizeNumber(String(value));
}

export function labelsMatch(expectedTargetLabel: string, targetLabel: string): boolean {
  return normalizeText(expectedTargetLabel) === normalizeText(targetLabel);
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeNumber(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return normalizeText(value);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function evaluateArithmetic(input: string): number | null {
  const expression = input
    .replace(/×/g, "*")
    .replace(/x/g, "*")
    .replace(/÷/g, "/")
    .replace(/⁄/g, "/")
    .replace(/²/g, "**2")
    .replace(/³/g, "**3")
    .replace(/\^/g, "**")
    .trim();
  if (!/^[\d\s+\-*/().*]+$/.test(expression)) return null;
  try {
    const result = Function(`"use strict"; return (${expression})`)() as unknown;
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
