const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8000;
const EMAIL_FILE = path.join(__dirname, 'email_subscribers.txt');
const NOTIFY_EMAIL = 'kevin@phillysports.com';

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp'
};

const server = http.createServer((req, res) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Handle subscription POST request
    if (req.method === 'POST' && req.url === '/subscribe.php') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { email } = JSON.parse(body);

                // Validate email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!email || !emailRegex.test(email)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Invalid email address' }));
                    return;
                }

                const timestamp = new Date().toISOString();
                const logEntry = `${timestamp} - ${email}\n`;

                // Append to email list file
                fs.appendFile(EMAIL_FILE, logEntry, (err) => {
                    if (err) console.error('Failed to write email:', err);
                });

                // Send notification email (using mail command on Unix systems)
                const subject = 'New PhillySports.com Subscriber!';
                const message = `New subscriber signup:\n\nEmail: ${email}\nDate: ${timestamp}\n\n--\nPhillySports.com Notification System`;

                // Try to send email using the system's mail command
                const mailCmd = `echo "${message}" | mail -s "${subject}" ${NOTIFY_EMAIL}`;
                exec(mailCmd, (error) => {
                    if (error) {
                        console.log(`Note: Could not send email notification (mail command not available)`);
                        console.log(`New subscriber: ${email}`);
                    } else {
                        console.log(`Email notification sent for: ${email}`);
                    }
                });

                console.log(`New subscriber: ${email}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Successfully subscribed!' }));

            } catch (error) {
                console.error('Error processing subscription:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Server error' }));
            }
        });
        return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n  PhillySports.com Development Server`);
    console.log(`  ------------------------------------`);
    console.log(`  Running at: http://localhost:${PORT}`);
    console.log(`  Email list: ${EMAIL_FILE}`);
    console.log(`  Notifications: ${NOTIFY_EMAIL}\n`);
});
