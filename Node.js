const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Helper to enable CORS
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const server = http.createServer((req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
        return;
    }

    if (req.method === 'POST' && req.url === '/write') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { path: filePath, content } = JSON.parse(body);
                if (!filePath || content === undefined) {
                    throw new Error('Missing path or content');
                }

                // Security: Prevent writing outside current directory
                const targetPath = path.resolve(process.cwd(), filePath);
                if (!targetPath.startsWith(process.cwd())) {
                    throw new Error('Access denied: Cannot write outside project root');
                }

                // Create directory if it doesn't exist
                const dir = path.dirname(targetPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                fs.writeFileSync(targetPath, content, 'utf8');
                console.log(`[Bridge] Updated: ${filePath}`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                console.error('[Bridge] Error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', '⚡ Claude Bridge is running!');
    console.log(`   Listening on http://localhost:${PORT}`);
    console.log('   Ready to receive file edits from the web app.');
});