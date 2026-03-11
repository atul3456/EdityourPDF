<?php
// api/config.php
// Configuration for GlassyTools Backend

define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_FILE_SIZE', 50 * 1024 * 1024); // 50MB
define('ALLOWED_TYPES', ['application/pdf', 'image/jpeg', 'image/png']);

// Tool Paths - Change these if tools are not in system PATH
define('CMD_GS', 'gs'); // Ghostscript (Windows: 'gswin64c' or 'C:/Program Files/gs/gs10.04.0/bin/gswin64c.exe')
define('CMD_MAGICK', 'C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe'); // ImageMagick verified path
define('CMD_QPDF', 'qpdf'); // QPDF
define('CMD_TESSERACT', 'C:/Program Files/Tesseract-OCR/tesseract.exe'); // Tesseract verified path

// CORS Headers (Allow local development)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Timezone
date_default_timezone_set('UTC');
?>
