<?php
// api/ocr.php
require_once 'utils.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Method not allowed', 405);

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['filename'])) sendError('No filename provided');
$filename = basename($data['filename']);
$inputFile = UPLOAD_DIR . $filename;
$outputBase = UPLOAD_DIR . 'ocr_' . pathinfo($filename, PATHINFO_FILENAME);
$outputPdf = $outputBase . '.pdf';

if (!file_exists($inputFile)) sendError('File not found', 404);

// 1. Convert PDF to High-Res TIFF (using Ghostscript)
// This is robust for multi-page PDFs
$tiffFile = UPLOAD_DIR . 'temp_' . bin2hex(random_bytes(8)) . '.tif';
$gsCmd = sprintf(
    '%s -sDEVICE=tiffg4 -r300 -o "%s" "%s"',
    CMD_GS,
    $tiffFile,
    $inputFile
);

exec($gsCmd . ' 2>&1', $gsOutput, $gsReturn);

if ($gsReturn !== 0) {
    // Cleanup if possible
    @unlink($tiffFile);
    $errorMsg = implode("\n", $gsOutput);
    if (strpos($errorMsg, 'not recognized') !== false || strpos($errorMsg, 'not found') !== false) {
        sendError("Ghostscript is not installed or not in PATH. Please install Ghostscript (https://ghostscript.com/releases/gsdnld.html) and add it to your system PATH, or configure the path in api/config.php.");
    }
    sendError('Ghostscript conversion failed: ' . $errorMsg);
}

// 2. OCR using Tesseract (TIFF -> Searchable PDF)
// Command: tesseract input.tif outputbase -l eng pdf
$tessCmd = sprintf(
    '%s "%s" "%s" -l eng pdf',
    CMD_TESSERACT,
    $tiffFile,
    $outputBase // Tesseract automatically adds .pdf extension
);

exec($tessCmd . ' 2>&1', $tessOutput, $tessReturn);

// Cleanup TIFF
@unlink($tiffFile);

if ($tessReturn !== 0) {
    $errorMsg = implode("\n", $tessOutput);
    if (strpos($errorMsg, 'not recognized') !== false || strpos($errorMsg, 'not found') !== false) {
        sendError("Tesseract OCR is not installed or not in PATH. Please install Tesseract (https://github.com/UB-Mannheim/tesseract/wiki) and add it to your system PATH, or configure the path in api/config.php.");
    }
    sendError('Tesseract OCR failed: ' . $errorMsg);
}

if (file_exists($outputPdf)) {
    sendJson([
        'success' => true,
        'url' => '/uploads/' . basename($outputPdf),
        'filename' => basename($outputPdf)
    ]);
} else {
    sendError('Failed to generate OCR PDF');
}
?>
