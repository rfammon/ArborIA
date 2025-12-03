const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const ROOT_DIR = process.cwd();

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

// Script injetado para Editor Visual (v3.7.0)
const VISUAL_EDITOR_SCRIPT = `
<script>
(function() {
    console.log('[DevAgent] Bridge v3.7.0 Loaded');
    let active = false;
    let hoveredElement = null;
    let selectedElement = null;
    let isDragging = false;
    let isResizing = false;
    let startX = 0, startY = 0;
    let startWidth = 0, startHeight = 0;
    let initialTransform = { x: 0, y: 0 };

    function getReactSource(domNode) {
        for (const key in domNode) {
            if (key.startsWith('__reactFiber')) {
                const fiber = domNode[key];
                let curr = fiber;
                while (curr) {
                    if (curr._debugSource) return curr._debugSource;
                    if (curr._debugOwner && curr._debugOwner._debugSource) return curr._debugOwner._debugSource;
                    curr = curr.return;
                }
            }
        }
        return null;
    }

    // --- GIZMO UI ---
    const gizmo = document.createElement('div');
    gizmo.style.cssText = 'position: absolute; border: 2px solid #ef4444; z-index: 2147483647; pointer-events: none; display: none; box-sizing: border-box; box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);';
    
    const handle = document.createElement('div');
    handle.style.cssText = 'position: absolute; bottom: -8px; right: -8px; width: 16px; height: 16px; background: #ef4444; cursor: nwse-resize; pointer-events: auto; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);';
    gizmo.appendChild(handle);
    document.body.appendChild(gizmo);

    function updateGizmo(el) {
        if (!el || !active) { gizmo.style.display = 'none'; return; }
        const rect = el.getBoundingClientRect();
        gizmo.style.display = 'block';
        gizmo.style.top = (window.scrollY + rect.top) + 'px';
        gizmo.style.left = (window.scrollX + rect.left) + 'px';
        gizmo.style.width = rect.width + 'px';
        gizmo.style.height = rect.height + 'px';
    }

    // --- MESSAGE HANDLER ---
    window.addEventListener('message', (e) => {
        if (e.data.type === 'TOGGLE_VISUAL_MODE') {
            active = e.data.enabled;
            if (!active) {
                gizmo.style.display = 'none';
                if (hoveredElement) hoveredElement.style.outline = '';
                selectedElement = null;
            }
        }
        if (e.data.type === 'APPLY_STYLE_PREVIEW') {
             if (selectedElement) {
                 const { className, style, innerText } = e.data.payload;
                 if (className !== undefined) selectedElement.className = className;
                 if (style) Object.assign(selectedElement.style, style);
                 if (innerText !== undefined) selectedElement.innerText = innerText;
                 updateGizmo(selectedElement);
             }
        }
        if (e.data.type === 'SCAN_SIMILAR_ELEMENTS') {
             window.parent.postMessage({ type: 'SCAN_RESULT', payload: [] }, '*');
        }
    });

    document.addEventListener('mouseover', (e) => {
        if (!active || isDragging || isResizing || e.target === gizmo || e.target === handle) return;
        if (hoveredElement && hoveredElement !== e.target) hoveredElement.style.outline = '';
        hoveredElement = e.target;
        e.target.style.outline = '2px dashed #007acc';
    });

    document.addEventListener('mouseout', (e) => {
        if (!active || isDragging || isResizing) return;
        if (e.target.style.outline.includes('dashed')) e.target.style.outline = '';
    });

    function getTranslate(el) {
        const style = window.getComputedStyle(el);
        const transform = style.transform;
        if (!transform || transform === 'none') return { x: 0, y: 0 };
        try {
            const matrix = new DOMMatrix(transform);
            return { x: matrix.m41, y: matrix.m42 };
        } catch (e) {
            return { x: 0, y: 0 };
        }
    }

    // --- EVENTS ---
    handle.addEventListener('mousedown', (e) => {
        if (!active || !selectedElement) return;
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = selectedElement.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
    });

    document.addEventListener('mousedown', (e) => {
        if (!active) return;
        if (e.target === handle) return;
        
        e.preventDefault();
        
        if (hoveredElement) hoveredElement.style.outline = '';
        selectedElement = e.target;
        updateGizmo(selectedElement);
        
        const debugSource = getReactSource(selectedElement);
        const styles = window.getComputedStyle(selectedElement);
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialTransform = getTranslate(selectedElement);

        const payload = {
            tagName: selectedElement.tagName,
            id: selectedElement.id,
            className: selectedElement.className,
            innerText: selectedElement.innerText ? selectedElement.innerText.substring(0, 50) : '',
            debugSource: debugSource,
            styles: {
                color: styles.color,
                backgroundColor: styles.backgroundColor,
                padding: styles.padding,
                borderRadius: styles.borderRadius,
                width: styles.width,
                height: styles.height,
                transform: styles.transform
            }
        };
        window.parent.postMessage({ type: 'ELEMENT_SELECTED', payload }, '*');
    }, true);

    window.addEventListener('mousemove', (e) => {
        if (!active || !selectedElement) return;

        if (isResizing) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newW = Math.max(10, startWidth + dx);
            const newH = Math.max(10, startHeight + dy);
            selectedElement.style.width = newW + 'px';
            selectedElement.style.height = newH + 'px';
            updateGizmo(selectedElement);
            window.parent.postMessage({ 
                type: 'ELEMENT_MODIFIED', 
                payload: { style: { width: newW + 'px', height: newH + 'px' } } 
            }, '*');
            return;
        }

        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newX = initialTransform.x + dx;
            const newY = initialTransform.y + dy;
            // ESCAPED BACKTICKS FOR BRIDGE SCRIPT COMPATIBILITY
            const transformStr = \`translate(\${newX}px, \${newY}px)\`;
            selectedElement.style.transform = transformStr;
            updateGizmo(selectedElement);
            window.parent.postMessage({ 
                type: 'ELEMENT_MODIFIED', 
                payload: { style: { transform: transformStr } } 
            }, '*');
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging || isResizing) {
            isDragging = false;
            isResizing = false;
            if (selectedElement) {
                const styles = window.getComputedStyle(selectedElement);
                window.parent.postMessage({ 
                    type: 'ELEMENT_MODIFIED', 
                    payload: { 
                        style: { 
                            width: styles.width, 
                            height: styles.height, 
                            transform: styles.transform 
                        } 
                    } 
                }, '*');
            }
        }
    });
})();
</script>
`;

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

const getFileTree = (dir) => {
    try {
        const stats = fs.statSync(dir);
        if (!stats.isDirectory()) return [];

        const items = fs.readdirSync(dir);
        const nodes = [];

        for (const item of items) {
            if (item === 'node_modules' || item === '.git' || item === 'dist') continue;
            
            const fullPath = path.join(dir, item);
            const relPath = path.relative(ROOT_DIR, fullPath).split(path.sep).join('/');
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
    } catch (e) {
        return [];
    }
};

const server = http.createServer((req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, 'http://localhost');

    try {
        if (url.pathname === '/health') {
            return sendJSON(res, { status: 'ok', version: '3.7.0', features: ['files', 'read', 'write', 'exec', 'static', 'visual-editor', 'react-inspector', 'drag-resize-v2'] });
        }

        if (url.pathname === '/files') {
            const tree = getFileTree(ROOT_DIR);
            return sendJSON(res, tree);
        }

        if (url.pathname === '/read') {
            const filePath = url.searchParams.get('path');
            if (!filePath) return sendError(res, 'Missing path param', 400);
            const fullPath = path.resolve(ROOT_DIR, filePath);
            if (!fullPath.startsWith(ROOT_DIR)) return sendError(res, 'Access denied', 403);
            if (!fs.existsSync(fullPath)) return sendError(res, 'File not found', 404);
            const content = fs.readFileSync(fullPath, 'utf8');
            return sendJSON(res, { content });
        }

        if (req.method === 'POST' && url.pathname === '/write') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { path: filePath, content } = JSON.parse(body);
                    const fullPath = path.resolve(ROOT_DIR, filePath);
                    if (!fullPath.startsWith(ROOT_DIR)) return sendError(res, 'Access denied', 403);
                    const dir = path.dirname(fullPath);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(fullPath, content, 'utf8');
                    return sendJSON(res, { success: true });
                } catch (e) { return sendError(res, e.message); }
            });
            return;
        }

        if (req.method === 'POST' && url.pathname === '/exec') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { command } = JSON.parse(body);
                    exec(command, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
                        const output = stdout + (stderr ? '\n[stderr]\n' + stderr : '');
                        return sendJSON(res, { output: output || (error ? error.message : 'No output'), error: !!error });
                    });
                } catch (e) { return sendError(res, e.message); }
            });
            return;
        }

        // STATIC FILE SERVER WITH NO-CACHE
        let filePath = '.' + url.pathname;
        if (filePath === './') filePath = './index.html';
        
        const extname = String(path.extname(filePath)).toLowerCase();
        const mimeType = MIME_TYPES[extname] || 'application/octet-stream';
        
        const fullPath = path.resolve(ROOT_DIR, filePath);
        if (!fullPath.startsWith(ROOT_DIR)) return sendError(res, 'Access denied', 403);

        fs.readFile(fullPath, (error, content) => {
            if (error) {
                if(error.code == 'ENOENT') {
                    return sendError(res, 'File not found', 404);
                } else {
                    return sendError(res, error.code, 500);
                }
            } else {
                res.setHeader('Content-Type', mimeType);
                // Force No-Cache to ensure Live Preview is always fresh
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                
                if (mimeType === 'text/html') {
                    const html = content.toString('utf-8');
                    const injectedHtml = html.includes('</body>') 
                        ? html.replace('</body>', VISUAL_EDITOR_SCRIPT + '</body>') 
                        : html + VISUAL_EDITOR_SCRIPT;
                    res.end(injectedHtml, 'utf-8');
                } else {
                    res.end(content, 'utf-8');
                }
            }
        });

    } catch (err) {
        sendError(res, err.message);
    }
});

server.listen(PORT, () => {
    console.log('Bridge & Live Server (v3.7.0) running at http://localhost:' + PORT);
});