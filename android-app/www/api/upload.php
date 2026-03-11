<?php
// api/upload.php
require_once 'utils.php';

// Handle CORS Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

// Run Cleanup on every upload request
cleanupOldFiles();

if (!isset($_FILES['file'])) {
    sendError('No file uploaded');
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    sendError('Upload failed with code ' . $file['error']);
}

if ($file['size'] > MAX_FILE_SIZE) {
    sendError('File too large (Max 50MB)');
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);

if (!in_array($mime, ALLOWED_TYPES)) {
    sendError('Invalid file type: ' . $mime);
}

// Ensure Upload Dir Exists
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0777, true);
}

$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = generateFilename($ext);
$destination = UPLOAD_DIR . $filename;

if (move_uploaded_file($file['tmp_name'], $destination)) {
    sendJson([
        'success' => true,
        'filename' => $filename,
        'originalName' => $file['name'],
        'path' => $destination,
        'url' => '/uploads/' . $filename // Assuming server root
    ]);
} else {
    sendError('Failed to save file');
}
?>
