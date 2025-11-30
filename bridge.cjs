const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const ROOT_DIR = process.cwd();

const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const sendJSON = (res, data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};

const sendError = (res, message, status = 500) => {
    sendJSON(res, { error: message }, status);
};

// Recursive function to get file tree
const getFileTree = (dir) => {
    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) return [];

    const items = fs.readdirSync(dir);
    const nodes = [];

    for (const item of items) {
        if (item === 'node_modules' || item === '.git' || item === 'dist') continue;
        
        const fullPath = path.join(dir, item);
        const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
        const itemStats = fs.statSync(fullPath);

        if (itemStats.isDirectory()) {
            nodes.push({
                name: item,
                path: relPath,
                type: 'directory',
                children: getFileTree(fullPath)
            });
        } else {
            nodes.push({
                name: item,
                path: relPath,
                type: 'file'
            });
        }
    }
    return nodes;
};

const server = http.createServer((req, res) => {
    setCorsHeaders(res);
    console.log(`${req.method} ${req.url}`);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Use a dummy host to parse the URL safely
    const url = new URL(req.url, 'http://localhost');

    try {
        // GET /health
        if (req.method === 'GET' && url.pathname === '/health') {
            return sendJSON(res, { status: 'ok', version: '2.0.0' });
        }

        // GET /files
        if (req.method === 'GET' && url.pathname === '/files') {
            try {
                // We currently return the full tree regardless of path, 
                // but could extend this to support partial trees in the future.
                const tree = getFileTree(ROOT_DIR);
                return sendJSON(res, tree);
            } catch (e) {
                console.error("Error getting file tree:", e);
                return sendError(res, "Failed to read directory structure: " + e.message);
            }
        }

        // GET /read?path=...
        if (req.method === 'GET' && url.pathname === '/read') {
            const filePath = url.searchParams.get('path');
            if (!filePath) return sendError(res, 'Missing path param', 400);

            const fullPath = path.resolve(ROOT_DIR, filePath);
            if (!fullPath.startsWith(ROOT_DIR)) return sendError(res, 'Access denied', 403);

            if (!fs.existsSync(fullPath)) return sendError(res, 'File not found', 404);
            
            const content = fs.readFileSync(fullPath, 'utf8');
            return sendJSON(res, { content });
        }

        // POST /write
        if (req.method === 'POST' && url.pathname === '/write') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { path: filePath, content } = JSON.parse(body);
                    if (!filePath || content === undefined) return sendError(res, 'Invalid body', 400);

                    const fullPath = path.resolve(ROOT_DIR, filePath);
                    if (!fullPath.startsWith(ROOT_DIR)) return sendError(res, 'Access denied', 403);

                    const dir = path.dirname(fullPath);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                    fs.writeFileSync(fullPath, content, 'utf8');
                    return sendJSON(res, { success: true });
                } catch (e) {
                    return sendError(res, e.message);
                }
            });
            return;
        }

        // POST /exec (Terminal Command)
        if (req.method === 'POST' && url.pathname === '/exec') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { command } = JSON.parse(body);
                    if (!command) return sendError(res, 'Missing command', 400);
                    
                    console.log('Running:', command);
                    exec(command, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
                        const output = stdout + (stderr ? '\n[stderr]\n' + stderr : '');
                        // We return 200 even on error so the client displays the output/error
                        return sendJSON(res, { 
                            output: output || (error ? error.message : 'Command executed with no output.'),
                            error: !!error 
                        });
                    });
                } catch (e) {
                    return sendError(res, e.message);
                }
            });
            return;
        }

        sendError(res, 'Not Found', 404);

    } catch (err) {
        console.error(err);
        sendError(res, err.message);
    }
});

server.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', '⚡ DevAgent Bridge running on http://localhost:' + PORT);
    console.log('   Endpoints: /files, /read, /write, /exec');
});