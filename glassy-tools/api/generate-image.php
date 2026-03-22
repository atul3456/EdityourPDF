<?php
/**
 * generate-image.php
 * PHP proxy for Hyperreal AI image generation.
 * Bypasses browser CORS restrictions by making the request server-side.
 */

// ── CORS headers (allow same-origin calls from the browser) ──────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Read request body ────────────────────────────────────────────────────────
$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody, true);

if (!$payload || empty($payload['prompt'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing prompt']);
    exit;
}

// ── Read API key (from request header or from config) ────────────────────────
$apiKey = '';

// 1. Try custom header sent by JS
$headers = getallheaders();
if (!empty($headers['X-Hyperreal-Key'])) {
    $apiKey = trim($headers['X-Hyperreal-Key']);
}

// 2. Fallback: environment variable
if (!$apiKey && getenv('HYPERREAL_API_KEY')) {
    $apiKey = getenv('HYPERREAL_API_KEY');
}

// 3. Fallback: load from config.php if present and constant is defined
if (!$apiKey && file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
    if (defined('HYPERREAL_API_KEY')) {
        $apiKey = constant('HYPERREAL_API_KEY');
    }
}

if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['error' => 'Hyperreal API key not configured on server']);
    exit;
}

// ── Forward to Hyperreal AI ──────────────────────────────────────────────────
$hyperrealUrl = 'https://hyperreal.tech/api/v1/images/generate';

$ch = curl_init($hyperrealUrl);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 120,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ],
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    http_response_code(502);
    echo json_encode(['error' => 'Proxy could not reach Hyperreal API: ' . $curlErr]);
    exit;
}

// If Hyperreal returned an error, wrap it with extra debug info
if ($httpCode < 200 || $httpCode >= 300) {
    http_response_code($httpCode);
    // Try to decode and re-wrap with status info
    $decoded = json_decode($response, true);
    if ($decoded !== null) {
        $decoded['_proxy_status'] = $httpCode;
        echo json_encode($decoded);
    } else {
        echo json_encode([
            'error'          => 'Hyperreal API returned HTTP ' . $httpCode,
            '_proxy_status'  => $httpCode,
            '_raw_response'  => substr($response, 0, 500),
        ]);
    }
} else {
    http_response_code($httpCode);
    echo $response;
}
