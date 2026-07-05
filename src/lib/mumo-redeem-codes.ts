import { useEffect, useState } from "react";

export type MumoRedeemCodeStatus = "unused" | "used" | "disabled";

export type MumoRedeemCode = {
  id: string;
  code: string;
  credits: number;
  status: MumoRedeemCodeStatus;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
};

export type MumoRedeemResult =
  | { ok: true; credits: number; record: MumoRedeemCode }
  | { ok: false; reason: "format" | "missing" | "used" | "disabled" };

export const MUMO_REDEEM_CODES_KEY = "mumo_redeem_codes";
const CHANGE_EVENT = "mumo-redeem-codes-change";
const CODE_PATTERN = /^MUMO-[A-Z0-9]{4,8}(?:-[A-Z0-9]{4,8})+$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeMumoRedeemCode(value: string) {
  return value.trim().toUpperCase();
}

export function isMumoRedeemCodeFormat(value: string) {
  return CODE_PATTERN.test(normalizeMumoRedeemCode(value));
}

export function readMumoRedeemCodes(): MumoRedeemCode[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(MUMO_REDEEM_CODES_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(isMumoRedeemCodeRecord);
  } catch {
    return [];
  }
}

export function writeMumoRedeemCodes(records: MumoRedeemCode[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUMO_REDEEM_CODES_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function generateMumoRedeemCodes(count: number, credits: number) {
  const safeCount = Math.min(200, Math.max(1, Math.floor(count)));
  const safeCredits = Math.max(1, Math.floor(credits));
  const current = readMumoRedeemCodes();
  const known = new Set(current.map((record) => record.code));
  const created: MumoRedeemCode[] = [];

  while (created.length < safeCount) {
    const code = `MUMO-${randomGroup(4)}-${randomGroup(4)}`;
    if (known.has(code)) continue;
    known.add(code);
    created.push({
      id: createLocalId(),
      code,
      credits: safeCredits,
      status: "unused",
      usedBy: null,
      usedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  writeMumoRedeemCodes([...created, ...current]);
  return created;
}

export function updateMumoRedeemCodeStatus(id: string, status: "unused" | "disabled") {
  writeMumoRedeemCodes(readMumoRedeemCodes().map((record) =>
    record.id === id && record.status !== "used" ? { ...record, status } : record,
  ));
}

export function deleteMumoRedeemCode(id: string) {
  writeMumoRedeemCodes(readMumoRedeemCodes().filter((record) => record.id !== id));
}

export function clearDisabledMumoRedeemCodes() {
  writeMumoRedeemCodes(readMumoRedeemCodes().filter((record) => record.status !== "disabled"));
}

export function redeemMumoCode(value: string, usedBy: string): MumoRedeemResult {
  const normalized = normalizeMumoRedeemCode(value);
  if (!isMumoRedeemCodeFormat(normalized)) return { ok: false, reason: "format" };

  const records = readMumoRedeemCodes();
  const target = records.find((record) => record.code === normalized);
  if (!target) return { ok: false, reason: "missing" };
  if (target.status === "used") return { ok: false, reason: "used" };
  if (target.status === "disabled") return { ok: false, reason: "disabled" };

  const redeemed: MumoRedeemCode = {
    ...target,
    status: "used",
    usedBy,
    usedAt: new Date().toISOString(),
  };
  writeMumoRedeemCodes(records.map((record) => record.id === target.id ? redeemed : record));
  return { ok: true, credits: redeemed.credits, record: redeemed };
}

export function useMumoRedeemCodes() {
  const [records, setRecords] = useState<MumoRedeemCode[]>(readMumoRedeemCodes);

  useEffect(() => {
    const refresh = () => setRecords(readMumoRedeemCodes());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { records, refresh: () => setRecords(readMumoRedeemCodes()) };
}

function isMumoRedeemCodeRecord(value: unknown): value is MumoRedeemCode {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<MumoRedeemCode>;
  return (
    typeof record.id === "string" &&
    typeof record.code === "string" &&
    typeof record.credits === "number" &&
    (record.status === "unused" || record.status === "used" || record.status === "disabled") &&
    (record.usedBy === null || typeof record.usedBy === "string") &&
    (record.usedAt === null || typeof record.usedAt === "string") &&
    typeof record.createdAt === "string"
  );
}

function randomGroup(length: number) {
  const bytes = new Uint32Array(length);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < length; index += 1) bytes[index] = Math.floor(Math.random() * 0xffffffff);
  }
  return Array.from(bytes, (value) => ALPHABET[value % ALPHABET.length]).join("");
}

function createLocalId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `mumo-${Date.now()}-${randomGroup(6)}`;
}
