<?php
// api/security.php
require_once 'utils.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Method not allowed', 405);

$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['filename']) || !isset($data['action'])) sendError('Missing parameters');

$filename = basename($data['filename']);
$inputFile = UPLOAD_DIR . $filename;
$outputFile = UPLOAD_DIR . 'sec_' . $filename;

if (!file_exists($inputFile)) sendError('File not found', 404);

$action = $data['action'];
$cmd = '';

if ($action === 'protect') {
    $pass = escapeshellarg($data['password'] ?? '');
    // qpdf --encrypt user-password owner-password 256 -- input output
    // We use the same password for user and owner for simplicity unless specified
    $cmd = sprintf(
        '%s --encrypt %s %s 256 -- "%s" "%s"',
        CMD_QPDF,
        $pass,
        $pass,
        $inputFile,
        $outputFile
    );
} elseif ($action === 'unlock') {
    $pass = escapeshellarg($data['password'] ?? '');
    // qpdf --decrypt --password=pass input output
    $cmd = sprintf(
        '%s --decrypt --password=%s "%s" "%s"',
        CMD_QPDF,
        $pass,
        $inputFile,
        $outputFile
    );
} elseif ($action === 'permissions') {
    // qpdf --encrypt "" "" 256 --print=n --modify=n -- input output
    // Empty passwords mean no open password, but restrictions apply (hacky in PDF spec but works)
    // Actually standard compliant way: Must set an owner password to enforce restrictions.
    $ownerPass = 'owner123'; 
    $cmd = sprintf(
        '%s --encrypt "" %s 256 --print=n --modify=n --extract=n -- "%s" "%s"',
        CMD_QPDF,
        $ownerPass,
        $inputFile,
        $outputFile
    );
} else {
    sendError('Invalid action');
}

exec($cmd . ' 2>&1', $output, $return);

if ($return !== 0) {
    sendError('Security operation failed: ' . implode("\n", $output));
}

if (file_exists($outputFile)) {
    sendJson([
        'success' => true,
        'url' => '/uploads/' . basename($outputFile),
        'filename' => basename($outputFile)
    ]);
} else {
    sendError('Failed to process file');
}
?>
