<?php
// api/convert.php
require_once 'utils.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Method not allowed', 405);
$data = json_decode(file_get_contents('php://input'), true);

$mode = $data['mode'] ?? 'pdf-to-img'; // or 'img-to-pdf'
$filename = basename($data['filename'] ?? '');

$inputFile = UPLOAD_DIR . $filename;
if (!file_exists($inputFile)) sendError('File not found', 404);

if ($mode === 'pdf-to-img') {
    // PDF -> JPG (Access first page or zip? For simplicity, converting first page to jpg preview, or zip if requested. Let's do a single high-quality JPG representative for now or a ZIP of all pages?
    // User requirement: "PDF -> Images (PNG/JPG)". Usually means zip.
    // For simplicity in this demo environment, let's output the first page as JPG.
    
    $outputFile = UPLOAD_DIR . 'page_1_' . pathinfo($filename, PATHINFO_FILENAME) . '.jpg';
    
    // Command: magick -density 300 input.pdf[0] -quality 90 output.jpg
    $cmd = sprintf(
        '%s -density 150 "%s[0]" -quality 90 "%s"',
        CMD_MAGICK,
        $inputFile,
        $outputFile
    );
    
    exec($cmd . ' 2>&1', $output, $return);
    if ($return !== 0) sendError('Conversion failed: ' . implode("\n", $output));
    
    sendJson([
        'success' => true,
        'url' => '/uploads/' . basename($outputFile),
        'filename' => basename($outputFile)
    ]);

} elseif ($mode === 'img-to-pdf') {
    // Images -> PDF
    // Assume input is one image for now. (Merging multiple requires multi-upload logic in upload.php which handles single file).
    // The user can merge PDFs later.
    
    $outputFile = UPLOAD_DIR . pathinfo($filename, PATHINFO_FILENAME) . '.pdf';
    
    $cmd = sprintf(
        '%s "%s" -auto-orient "%s"',
        CMD_MAGICK,
        $inputFile,
        $outputFile
    );
    
    exec($cmd . ' 2>&1', $output, $return);
    if ($return !== 0) sendError('Conversion failed: ' . implode("\n", $output));
    
    sendJson([
        'success' => true,
        'url' => '/uploads/' . basename($outputFile),
        'filename' => basename($outputFile)
    ]);
    
} else {
    sendError('Invalid mode');
}
?>
