const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname);
const DIST_DIR = path.join(ROOT_DIR, "dist");

const MIN_SCORE = 100;
const MAX_ENTRIES = 10;
const NAME_MAX_LENGTH = 12;
const PROFANE = [
  "ASS",
  "FUCK",
  "SHIT",
  "CUNT",
  "DICK",
  "PISS",
  "TWAT",
  "PORN"
];
const INITIAL_SCORES = [
  { name: "WINGTIP", score: 75000 },
  { name: "WINGTIP", score: 52000 },
  { name: "WINGTIP", score: 37000 },
  { name: "WINGTIP", score: 23300 },
  { name: "WINGTIP", score: 12500 },
  { name: "WINGTIP", score: 5900 },
  { name: "WINGTIP", score: 3800 },
  { name: "WINGTIP", score: 1400 },
  { name: "WINGTIP", score: 600 },
  { name: "WINGTIP", score: 100 }
];

const leaderboard = [];
let nextId = 0;

app.use(express.json());

function sanitizeName(raw) {
  const cleaned = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, NAME_MAX_LENGTH);

  if (!cleaned) {
    return "ANON";
  }

  const isProfane = PROFANE.some((word) => cleaned.includes(word));
  return isProfane ? "ANON" : cleaned;
}

function normalizeScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return Math.floor(number);
}

function publicEntries() {
  return leaderboard.slice(0, MAX_ENTRIES).map((entry) => ({
    name: entry.name,
    score: entry.score
  }));
}

function insertScore(name, score) {
  const normalized = normalizeScore(score);
  if (normalized === null || normalized < MIN_SCORE) {
    return false;
  }
  const entry = {
    id: ++nextId,
    name: sanitizeName(name),
    score: normalized
  };
  leaderboard.push(entry);
  leaderboard.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.id - a.id;
  });

  if (leaderboard.length > MAX_ENTRIES) {
    leaderboard.length = MAX_ENTRIES;
  }
  return true;
}

function seedLeaderboard() {
  for (const entry of INITIAL_SCORES) {
    insertScore(entry.name, entry.score);
  }
}

seedLeaderboard();

app.get("/api/score", (req, res) => {
  res.json(publicEntries());
});

app.post("/api/score", (req, res) => {
  const score = normalizeScore(req.body?.score);
  if (score === null) {
    return res.status(400).json({ error: "Invalid score" });
  }
  if (score < MIN_SCORE) {
    return res.status(400).json({ error: "Score too low" });
  }

  const inserted = insertScore(req.body?.name, score);
  if (!inserted) {
    return res.status(400).json({ error: "Score too low" });
  }

  return res.status(201).json({ ok: true });
});

app.use(express.static(DIST_DIR));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
