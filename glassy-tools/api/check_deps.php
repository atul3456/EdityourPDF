4<?php
// api/check_deps.php
require_once 'config.php';

$response = [
    'ghostscript' => checkTool(CMD_GS, '--version'),
    'tesseract' => checkTool(CMD_TESSERACT, '--version'),
    'magick' => checkTool(CMD_MAGICK, '--version'),
    'qpdf' => checkTool(CMD_QPDF, '--version')
];

function checkTool($cmd, $arg) {
    $command = sprintf('%s %s 2>&1', $cmd, $arg);
    exec($command, $output, $returnVar);
    return [
        'installed' => $returnVar === 0,
        'command' => $cmd,
        'output' => implode("\n", array_slice($output, 0, 1)) // First line only
    ];
}

header('Content-Type: application/json');
echo json_encode($response, JSON_PRETTY_PRINT);
?>
