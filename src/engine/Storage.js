// Storage.js — localStorage persistence for badges + settings.
// Contains NO game content. Keys only.
const KEY = 'coreseven.save.v1';

const DEFAULT_STATE = {
  badges: {},        // { [eventId]: { earnedAt, score } }
  seenEvents: {},    // { [eventId]: true }  (encountered = unlocked for wild quiz)
  settings: {},      // { theme, sound, ... } overrides config defaults
  bestScores: {}     // { [eventId]: score }
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredCloneSafe(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return Object.assign(structuredCloneSafe(DEFAULT_STATE), parsed);
  } catch (e) {
    return structuredCloneSafe(DEFAULT_STATE);
  }
}

function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }

function write(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode / quota */ }
}

export const Storage = {
  get() { return read(); },

  hasBadge(eventId) { return !!read().badges[eventId]; },

  earnedBadges() { return Object.keys(read().badges); },

  awardBadge(eventId, score) {
    const s = read();
    s.badges[eventId] = { earnedAt: nowISO(), score: round2(score) };
    s.seenEvents[eventId] = true;
    if (!s.bestScores[eventId] || score > s.bestScores[eventId]) s.bestScores[eventId] = round2(score);
    write(s);
  },

  markSeen(eventId) {
    const s = read();
    if (!s.seenEvents[eventId]) { s.seenEvents[eventId] = true; write(s); }
  },

  seenEvents() { return Object.keys(read().seenEvents); },

  recordScore(eventId, score) {
    const s = read();
    if (!s.bestScores[eventId] || score > s.bestScores[eventId]) { s.bestScores[eventId] = round2(score); write(s); }
  },

  bestScore(eventId) { return read().bestScores[eventId] || 0; },

  getSetting(key, fallback) {
    const v = read().settings[key];
    return v === undefined ? fallback : v;
  },

  setSetting(key, value) {
    const s = read();
    s.settings[key] = value;
    write(s);
  },

  reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
};

function nowISO() { try { return new Date().toISOString(); } catch (e) { return ''; } }
function round2(n) { return Math.round(n * 100) / 100; }
