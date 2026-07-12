<?php

declare(strict_types=1);

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

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
  "PORN",
  "BUTT",
  "PENIS",
  "VAGINA",
  "URINE"
];
const INITIAL_SCORES = [
  ["name" => "WINGTIP", "score" => 75000],
  ["name" => "WINGTIP", "score" => 52000],
  ["name" => "WINGTIP", "score" => 37000],
  ["name" => "WINGTIP", "score" => 23300],
  ["name" => "WINGTIP", "score" => 12500],
  ["name" => "WINGTIP", "score" => 5900],
  ["name" => "WINGTIP", "score" => 3800],
  ["name" => "WINGTIP", "score" => 1400],
  ["name" => "WINGTIP", "score" => 600],
  ["name" => "WINGTIP", "score" => 100]
];
const SCORE_TABLE = "scores";

function loadEnv(string $path): void {
  if (!is_readable($path)) {
    return;
  }
  $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  if ($lines === false) {
    return;
  }
  foreach ($lines as $line) {
    $line = trim($line);
    if ($line === "" || strpos($line, "#") === 0) {
      continue;
    }
    $parts = explode("=", $line, 2);
    if (count($parts) !== 2) {
      continue;
    }
    $key = trim($parts[0]);
    $value = trim($parts[1]);
    $value = trim($value, "\"'");
    if ($key === "") {
      continue;
    }
    if (getenv($key) === false) {
      putenv($key . "=" . $value);
      $_ENV[$key] = $value;
    }
  }
}

loadEnv(dirname(__DIR__) . DIRECTORY_SEPARATOR . ".env");

function getEnvOrDefault(string $key, string $default): string {
  $value = getenv($key);
  if ($value === false || $value === "") {
    return $default;
  }
  return $value;
}

function connectPdo(): PDO {
  $host = getEnvOrDefault("DB_HOST", "127.0.0.1");
  $port = getEnvOrDefault("DB_PORT", "3306");
  $dbName = getEnvOrDefault("DB_NAME", "game_scores");
  $user = getEnvOrDefault("DB_USER", "game_user");
  $pass = getEnvOrDefault("DB_PASS", "");
  $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
  return new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false
  ]);
}

function ensureTable(PDO $pdo): void {
  $sql = "CREATE TABLE IF NOT EXISTS " . SCORE_TABLE . " (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(12) NOT NULL,
    score INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX score_idx (score)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
  $pdo->exec($sql);
}

function sanitizeName($raw): string {
  $cleaned = strtoupper((string)$raw);
  $cleaned = preg_replace("/[^A-Z0-9_]/", "", $cleaned);
  if ($cleaned === null) {
    $cleaned = "";
  }
  $cleaned = substr($cleaned, 0, NAME_MAX_LENGTH);
  if ($cleaned === "") {
    return "ANON";
  }
  foreach (PROFANE as $word) {
    if (strpos($cleaned, $word) !== false) {
      return "ANON";
    }
  }
  return $cleaned;
}

function normalizeScore($value): ?int {
  if ($value === null || $value === "") {
    return null;
  }
  if (!is_numeric($value)) {
    return null;
  }
  return (int)floor((float)$value);
}

function getLeaderboard(PDO $pdo): array {
  $stmt = $pdo->query(
    "SELECT name, score FROM " . SCORE_TABLE . " ORDER BY score DESC, id DESC LIMIT " . MAX_ENTRIES
  );
  return $stmt->fetchAll();
}

function trimLeaderboard(PDO $pdo): void {
  $sql = "DELETE FROM " . SCORE_TABLE . " WHERE id NOT IN (
    SELECT id FROM (
      SELECT id FROM " . SCORE_TABLE . " ORDER BY score DESC, id DESC LIMIT " . MAX_ENTRIES . "
    ) AS keepers
  )";
  $pdo->exec($sql);
}

function insertScore(PDO $pdo, $name, $score): bool {
  $normalized = normalizeScore($score);
  if ($normalized === null || $normalized < MIN_SCORE) {
    return false;
  }
  $cleanName = sanitizeName($name);
  $stmt = $pdo->prepare("INSERT INTO " . SCORE_TABLE . " (name, score) VALUES (:name, :score)");
  $stmt->execute([
    ":name" => $cleanName,
    ":score" => $normalized
  ]);
  trimLeaderboard($pdo);
  return true;
}

function seedLeaderboard(PDO $pdo): void {
  $count = (int)$pdo->query("SELECT COUNT(*) FROM " . SCORE_TABLE)->fetchColumn();
  if ($count > 0) {
    return;
  }
  foreach (INITIAL_SCORES as $entry) {
    insertScore($pdo, $entry["name"], $entry["score"]);
  }
}

$pdo = connectPdo();
ensureTable($pdo);
seedLeaderboard($pdo);
