<?php

declare(strict_types=1);

require_once __DIR__ . "/../bootstrap.php";

header("Content-Type: application/json");

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";

if ($method === "GET") {
  echo json_encode(getLeaderboard($pdo));
  exit;
}

if ($method === "POST") {
  $raw = file_get_contents("php://input");
  $payload = json_decode($raw ?: "{}", true);
  if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid payload"]);
    exit;
  }

  $score = normalizeScore($payload["score"] ?? null);
  if ($score === null) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid score"]);
    exit;
  }
  if ($score < MIN_SCORE) {
    http_response_code(400);
    echo json_encode(["error" => "Score too low"]);
    exit;
  }

  $name = $payload["name"] ?? "";
  if (!insertScore($pdo, $name, $score)) {
    http_response_code(400);
    echo json_encode(["error" => "Score too low"]);
    exit;
  }

  http_response_code(201);
  echo json_encode(["ok" => true]);
  exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed"]);
