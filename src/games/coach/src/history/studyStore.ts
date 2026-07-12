import type {
  SavedDecisionRecord,
  SavedDrillAttempt,
  SavedHandHistory,
  SavedSessionSummary,
  StudyStore
} from "../core/types";

const STORAGE_KEY = "coach.studyStore";
const LEGACY_STORAGE_KEY = "coach.handHistory";
const STORAGE_VERSION = 2;
const MAX_SAVED_HANDS = 60;
const MAX_SAVED_DECISIONS = 300;
const MAX_SAVED_DRILL_ATTEMPTS = 300;
const MAX_SAVED_SESSIONS = 80;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSavedHandHistory(value: unknown): value is SavedHandHistory {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.version === "number" &&
    typeof value.timestamp === "string" &&
    Array.isArray(value.events) &&
    Array.isArray(value.actionLog) &&
    isObject(value.summary) &&
    isObject(value.tags)
  );
}

function isSavedDecisionRecord(value: unknown): value is SavedDecisionRecord {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.sourceType === "string" &&
    typeof value.spotKey === "string" &&
    Array.isArray(value.board) &&
    Array.isArray(value.heroHand) &&
    Array.isArray(value.actionOptions) &&
    isObject(value.coachEvaluation) &&
    Array.isArray(value.tags)
  );
}

function isSavedDrillAttempt(value: unknown): value is SavedDrillAttempt {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.scenarioId === "string" &&
    typeof value.spotKey === "string" &&
    isObject(value.coachEvaluation) &&
    Array.isArray(value.tags)
  );
}

function isSavedSessionSummary(value: unknown): value is SavedSessionSummary {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.timestampStart === "string" &&
    typeof value.timestampEnd === "string" &&
    typeof value.mode === "string" &&
    typeof value.handsPlayed === "number" &&
    typeof value.decisionsTracked === "number" &&
    typeof value.drillAttempts === "number" &&
    typeof value.mistakesFlagged === "number" &&
    isObject(value.spotBreakdown)
  );
}

function sortNewest<T extends { timestamp?: string; timestampStart?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) =>
    (right.timestamp ?? right.timestampStart ?? "").localeCompare(left.timestamp ?? left.timestampStart ?? "")
  );
}

function limitNewest<T extends { timestamp?: string; timestampStart?: string }>(items: T[], max: number): T[] {
  return sortNewest(items).slice(0, max);
}

function emptyStore(): StudyStore {
  return {
    version: STORAGE_VERSION,
    hands: [],
    decisions: [],
    drillAttempts: [],
    sessions: []
  };
}

function normalizeStore(raw: unknown): StudyStore {
  if (!isObject(raw)) return emptyStore();

  if (typeof raw.version === "number" && Array.isArray(raw.hands) && Array.isArray(raw.decisions) && Array.isArray(raw.drillAttempts) && Array.isArray(raw.sessions)) {
    return {
      version: STORAGE_VERSION,
      hands: limitNewest(raw.hands.filter(isSavedHandHistory), MAX_SAVED_HANDS),
      decisions: limitNewest(raw.decisions.filter(isSavedDecisionRecord), MAX_SAVED_DECISIONS),
      drillAttempts: limitNewest(raw.drillAttempts.filter(isSavedDrillAttempt), MAX_SAVED_DRILL_ATTEMPTS),
      sessions: limitNewest(raw.sessions.filter(isSavedSessionSummary), MAX_SAVED_SESSIONS)
    };
  }

  if (typeof raw.version === "number" && Array.isArray(raw.hands)) {
    return {
      version: STORAGE_VERSION,
      hands: limitNewest(raw.hands.filter(isSavedHandHistory), MAX_SAVED_HANDS),
      decisions: [],
      drillAttempts: [],
      sessions: []
    };
  }

  return emptyStore();
}

function readLegacyHands(storage?: StorageLike): SavedHandHistory[] {
  const target = getStorage(storage);
  if (!target) return [];
  const parsed = safeJsonParse<{ version: number; hands: unknown[] }>(target.getItem(LEGACY_STORAGE_KEY));
  if (!parsed || !Array.isArray(parsed.hands)) return [];
  return limitNewest(parsed.hands.filter(isSavedHandHistory), MAX_SAVED_HANDS);
}

function writeStore(store: StudyStore, storage?: StorageLike): void {
  const target = getStorage(storage);
  if (!target) return;
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Non-blocking.
  }
}

export function readStudyStore(storage?: StorageLike): StudyStore {
  const target = getStorage(storage);
  if (!target) return emptyStore();

  const parsed = safeJsonParse<StudyStore>(target.getItem(STORAGE_KEY));
  let normalized = normalizeStore(parsed);
  const legacyHands = readLegacyHands(storage);
  if (legacyHands.length && normalized.hands.length === 0) {
    normalized = { ...normalized, hands: legacyHands };
  }
  if (parsed === null || normalized.version !== parsed?.version) {
    writeStore(normalized, storage);
  }
  return normalized;
}

function mergeById<T extends { id: string; timestamp?: string; timestampStart?: string }>(items: T[], next: T, max: number): T[] {
  return limitNewest([next, ...items.filter((item) => item.id !== next.id)], max);
}

export function saveStudyHand(hand: SavedHandHistory, storage?: StorageLike): void {
  const store = readStudyStore(storage);
  writeStore({ ...store, hands: mergeById(store.hands, hand, MAX_SAVED_HANDS) }, storage);
}

export function saveDecisionRecord(record: SavedDecisionRecord, storage?: StorageLike): void {
  const store = readStudyStore(storage);
  writeStore({ ...store, decisions: mergeById(store.decisions, record, MAX_SAVED_DECISIONS) }, storage);
}

export function saveDrillAttemptRecord(record: SavedDrillAttempt, storage?: StorageLike): void {
  const store = readStudyStore(storage);
  writeStore({ ...store, drillAttempts: mergeById(store.drillAttempts, record, MAX_SAVED_DRILL_ATTEMPTS) }, storage);
}

export function upsertSessionSummary(summary: SavedSessionSummary, storage?: StorageLike): void {
  const store = readStudyStore(storage);
  writeStore({ ...store, sessions: mergeById(store.sessions, summary, MAX_SAVED_SESSIONS) }, storage);
}

export function getRecentHands(limit = 10, storage?: StorageLike): SavedHandHistory[] {
  return readStudyStore(storage).hands.slice(0, Math.max(0, limit));
}

export function getRecentDecisions(limit = 10, storage?: StorageLike): SavedDecisionRecord[] {
  return readStudyStore(storage).decisions.slice(0, Math.max(0, limit));
}

export function getRecentDrillAttempts(limit = 10, storage?: StorageLike): SavedDrillAttempt[] {
  return readStudyStore(storage).drillAttempts.slice(0, Math.max(0, limit));
}

export function getSessionSummaries(limit = 10, storage?: StorageLike): SavedSessionSummary[] {
  return readStudyStore(storage).sessions.slice(0, Math.max(0, limit));
}

export function getDecisionById(id: string, storage?: StorageLike): SavedDecisionRecord | null {
  return readStudyStore(storage).decisions.find((record) => record.id === id) ?? null;
}

export function getDrillAttemptById(id: string, storage?: StorageLike): SavedDrillAttempt | null {
  return readStudyStore(storage).drillAttempts.find((record) => record.id === id) ?? null;
}

export function getHandById(id: string, storage?: StorageLike): SavedHandHistory | null {
  return readStudyStore(storage).hands.find((hand) => hand.id === id) ?? null;
}

export function getDecisionsForHand(handId: string, storage?: StorageLike): SavedDecisionRecord[] {
  return readStudyStore(storage).decisions.filter((record) => record.handId === handId);
}

export function getDecisionsBySpot(spotKey: SavedDecisionRecord["spotKey"], storage?: StorageLike): SavedDecisionRecord[] {
  return readStudyStore(storage).decisions.filter((record) => record.spotKey === spotKey);
}

export function getDrillAttemptsBySpot(spotKey: SavedDrillAttempt["spotKey"], storage?: StorageLike): SavedDrillAttempt[] {
  return readStudyStore(storage).drillAttempts.filter((record) => record.spotKey === spotKey);
}

export function updateStudyHandBookmark(id: string, bookmarked: boolean, storage?: StorageLike): void {
  const store = readStudyStore(storage);
  const hands = store.hands.map((hand) => {
    if (hand.id !== id) return hand;
    const reviewTags = new Set(hand.tags.reviewTags);
    if (bookmarked) reviewTags.add("bookmarked");
    else reviewTags.delete("bookmarked");
    return {
      ...hand,
      tags: {
        ...hand.tags,
        bookmarked,
        reviewTags: [...reviewTags]
      }
    };
  });
  writeStore({ ...store, hands }, storage);
}

export function deleteStudyHand(id: string, storage?: StorageLike): void {
  const store = readStudyStore(storage);
  writeStore({ ...store, hands: store.hands.filter((hand) => hand.id !== id) }, storage);
}

export function clearStudyStore(storage?: StorageLike): void {
  const target = getStorage(storage);
  if (!target) return;
  try {
    target.removeItem(STORAGE_KEY);
    target.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

export { STORAGE_KEY, STORAGE_VERSION, MAX_SAVED_HANDS };
