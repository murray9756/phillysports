<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL);

if (!$email) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email address']);
    exit;
}

$timestamp = date('Y-m-d H:i:s');
$logEntry = "$timestamp - $email\n";

// Append to email list file
$emailFile = __DIR__ . '/email_subscribers.txt';
if (file_put_contents($emailFile, $logEntry, FILE_APPEND | LOCK_EX) === false) {
    error_log("Failed to write to email subscribers file");
}

// Send notification email to kevin@phillysports.com
$to = 'kevin@phillysports.com';
$subject = 'New PhillySports.com Subscriber!';
$message = "New subscriber signup:\n\n";
$message .= "Email: $email\n";
$message .= "Date: $timestamp\n";
$message .= "\n--\nPhillySports.com Notification System";

$headers = [
    'From: noreply@phillysports.com',
    'Reply-To: ' . $email,
    'X-Mailer: PHP/' . phpversion(),
    'Content-Type: text/plain; charset=UTF-8'
];

$mailSent = mail($to, $subject, $message, implode("\r\n", $headers));

if (!$mailSent) {
    error_log("Failed to send notification email for subscriber: $email");
}

echo json_encode([
    'success' => true,
    'message' => 'Successfully subscribed!'
]);
?>
