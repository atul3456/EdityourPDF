<?php
// api/utils.php

require_once 'config.php';

function sendJson($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function sendError($message, $code = 400) {
    sendJson(['error' => true, 'message' => $message], $code);
}

function cleanupOldFiles() {
    $files = glob(UPLOAD_DIR . '*');
    $now = time();
    $maxAge = 3600; // 1 Hour

    foreach ($files as $file) {
        if (is_file($file)) {
            if ($now - filemtime($file) >= $maxAge) {
                unlink($file);
            }
        }
    }
}

// Generate a random secure filename
function generateFilename($ext) {
    return bin2hex(random_bytes(16)) . '.' . $ext;
}
?>
