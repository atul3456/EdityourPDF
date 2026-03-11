<?php
// api/compress.php
require_once 'utils.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Method not allowed', 405);
$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['filename']) || !isset($data['level'])) sendError('Missing parameters');

$filename = basename($data['filename']);
$inputFile = UPLOAD_DIR . $filename;
$outputFile = UPLOAD_DIR . 'opt_' . $filename;

if (!file_exists($inputFile)) sendError('File not found', 404);

// Ghostscript PDFSettings: /screen (low), /ebook (medium), /printer (high), /prepress (max quality)
$level = $data['level'];
$settings = '/ebook'; // default

if ($level === 'screen') $settings = '/screen';
elseif ($level === 'printer') $settings = '/printer';
elseif ($level === 'prepress') $settings = '/prepress';

// Command: gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/setting -dNOPAUSE -dQUIET -dBATCH -sOutputFile=output.pdf input.pdf
$cmd = sprintf(
    '%s -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=%s -dNOPAUSE -dQUIET -dBATCH -sOutputFile="%s" "%s"',
    CMD_GS,
    $settings,
    $outputFile,
    $inputFile
);

exec($cmd . ' 2>&1', $output, $return);

if ($return !== 0) {
    sendError('Compression failed: ' . implode("\n", $output));
}

if (file_exists($outputFile)) {
    sendJson([
        'success' => true,
        'url' => '/uploads/' . basename($outputFile),
        'filename' => basename($outputFile)
    ]);
} else {
    sendError('Compression output missing');
}
?>
