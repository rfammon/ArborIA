const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const PORT = 3000;
const ROOT_DIR = process.cwd();

// --- MCP CLIENT IMPLEMENTATION ---
const mcpServers = new Map();
let mcpRequestId = 1;

function setupMcpServer(name, command, args, env = {}) {
  if (mcpServers.has(name)) {
     try { mcpServers.get(name).process.kill(); } catch(e) {}
     mcpServers.delete(name);
  }
  console.log(`[MCP] Starting server '${name}': ${command} ${args.join(' ')}`);
  const proc = spawn(command, args, { 
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'inherit']
  });
  const serverData = { process: proc, pendingRequests: new Map(), buffer: '' };
  mcpServers.set(name, serverData);
  proc.stdout.on('data', (data) => {
    serverData.buffer += data.toString();
    const lines = serverData.buffer.split('\n');
    serverData.buffer = lines.pop();
    lines.forEach(line => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line);
        if (msg.id && serverData.pendingRequests.has(msg.id)) {
          const { resolve, reject } = serverData.pendingRequests.get(msg.id);
          serverData.pendingRequests.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      } catch (e) { console.error(`[MCP] JSON Parse Error (${name}):`, e); }
    });
  });
  proc.on('error', (err) => console.error(`[MCP] Error (${name}):`, err));
  sendMcpRequest(name, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'DevAgentBridge', version: '5.0.0' } }).then(res => {
    sendMcpNotification(name, 'notifications/initialized', {});
    console.log(`[MCP] Server '${name}' initialized.`);
  }).catch(e => console.error(`[MCP] Init failed for '${name}':`, e));
  return { success: true };
}

function sendMcpRequest(serverName, method, params) {
  return new Promise((resolve, reject) => {
    const server = mcpServers.get(serverName);
    if (!server) return reject(new Error('Server not found'));
    const id = mcpRequestId++;
    server.pendingRequests.set(id, { resolve, reject });
    const msg = { jsonrpc: '2.0', id, method, params };
    try { server.process.stdin.write(JSON.stringify(msg) + '\n'); } catch(e) { reject(e); }
  });
}

function sendMcpNotification(serverName, method, params) {
    const server = mcpServers.get(serverName);
    if (!server) return;
    const msg = { jsonrpc: '2.0', method, params };
    try { server.process.stdin.write(JSON.stringify(msg) + '\n'); } catch(e){}
}

// --- VISUAL EDITOR INJECTION SCRIPT (v6.0 - Advanced Direct Edit) ---
const INJECT_SCRIPT = `
<script>
  (function() {
    console.log('DevAgent Visual Editor v6.0 Injected');
    let selectedElement = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    
    function getReactFiber(dom) {
      const key = Object.keys(dom).find(key => key.startsWith('__reactFiber$'));
      return key ? dom[key] : null;
    }
    
    function getSource(dom) {
      const fiber = getReactFiber(dom);
      if (!fiber) return null;
      let curr = fiber;
      while (curr) {
        if (curr._debugSource) return curr._debugSource;
        curr = curr.return;
      }
      return null;
    }
    
    // Gizmo Elements
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.border = '2px solid #3b82f6';
    overlay.style.zIndex = '999999';
    overlay.style.pointerEvents = 'none';
    overlay.style.display = 'none';
    overlay.style.transition = 'all 0.1s ease-out';
    document.body.appendChild(overlay);
    
    const handleElementSelect = (el) => {
        selectedElement = el;
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        const source = getSource(el);
        
        overlay.style.display = 'block';
        overlay.style.top = rect.top + 'px';
        overlay.style.left = rect.left + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';

        window.parent.postMessage({
            type: 'ELEMENT_SELECTED',
            payload: {
              tagName: el.tagName,
              id: el.id,
              className: el.className,
              innerText: el.innerText.substring(0, 100),
              styles: {
                color: styles.color,
                backgroundColor: styles.backgroundColor,
                padding: styles.padding,
                margin: styles.margin,
                fontSize: styles.fontSize,
                borderRadius: styles.borderRadius,
                width: styles.width,
                height: styles.height,
                transform: styles.transform,
                display: styles.display
              },
              debugSource: source
            }
        }, '*');
    };
    
    document.addEventListener('mouseover', (e) => {
      if(isDragging) return;
      e.stopPropagation();
      e.target.style.outline = '1px dashed #3b82f6';
    }, true);
    
    document.addEventListener('mouseout', (e) => {
      e.stopPropagation();
      e.target.style.outline = '';
    }, true);
    
    document.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      handleElementSelect(e.target);
    }, true);
    
    // Real-time Preview Listener
    window.addEventListener('message', (event) => {
       if (event.data.type === 'APPLY_STYLE_PREVIEW') {
          if (!selectedElement) return;
          const { className, style, innerText } = event.data.payload;
          if (className !== undefined) selectedElement.className = className;
          if (innerText !== undefined) selectedElement.innerText = innerText;
          if (style) {
              for (const [key, value] of Object.entries(style)) {
                  selectedElement.style[key] = value;
              }
          }
          // Update overlay position
          const rect = selectedElement.getBoundingClientRect();
          overlay.style.top = rect.top + 'px';
          overlay.style.left = rect.left + 'px';
          overlay.style.width = rect.width + 'px';
          overlay.style.height = rect.height + 'px';
       }
    });
  })();
</script>
`;

const mimeTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ts': 'text/plain', '.tsx': 'text/plain', '.jsx': 'text/plain',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');
  // Aggressive No-Cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname === '/api/files') {
    const listFiles = (dir, depth = 0) => {
      if (depth > 10) return [];
      const results = [];
      try {
        if (!fs.existsSync(dir)) return [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
          const filePath = path.join(dir, file);
          if (['node_modules', '.git', '.DS_Store', 'dist'].includes(file)) return;
          try {
            const stat = fs.lstatSync(filePath);
            if (stat.isDirectory()) {
               if (stat.isSymbolicLink()) results.push({ name: file, path: filePath, isDirectory: true, isSymlink: true, children: [] });
               else results.push({ name: file, path: filePath, isDirectory: true, children: listFiles(filePath, depth + 1) });
            } else {
              results.push({ name: file, path: filePath, isDirectory: false });
            }
          } catch (e) {}
        });
      } catch (e) {}
      return results;
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(listFiles(ROOT_DIR)));
    return;
  }

  if (pathname === '/api/read' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
      try { const { filePath } = JSON.parse(body);
         if (!fs.existsSync(filePath)) throw new Error('File not found');
         const content = fs.readFileSync(filePath, 'utf-8');
         res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ content }));
      } catch (e) { res.writeHead(500); res.end(JSON.stringify({error: e.message})); }
    });
    return;
  }

  if (pathname === '/api/write' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
      try { const { filePath, content } = JSON.parse(body);
         const dir = path.dirname(filePath); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
         fs.writeFileSync(filePath, content);
         res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(500); res.end(JSON.stringify({error: e.message})); }
    });
    return;
  }

  if (pathname === '/api/exec' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
      const { command } = JSON.parse(body);
      exec(command, { cwd: ROOT_DIR }, (err, stdout, stderr) => {
         res.writeHead(200, { 'Content-Type': 'application/json' });
         res.end(JSON.stringify({ stdout, stderr, error: err ? err.message : null }));
      });
    });
    return;
  }

  // MCP ENDPOINTS
  if (pathname === '/api/mcp/connect' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
      const { name, command, args, env } = JSON.parse(body);
      try { setupMcpServer(name, command, args, env); res.writeHead(200); res.end(JSON.stringify({success: true})); }
      catch(e) { res.writeHead(500); res.end(JSON.stringify({error: e.message})); }
    });
    return;
  }
  if (pathname === '/api/mcp/list_tools' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
       const { serverName } = JSON.parse(body);
       sendMcpRequest(serverName, 'tools/list', {}).then(r => {
          res.writeHead(200); res.end(JSON.stringify(r));
       }).catch(e => { res.writeHead(500); res.end(JSON.stringify({error: e.message})); });
    });
    return;
  }
  if (pathname === '/api/mcp/call_tool' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => {
       const { serverName, toolName, args } = JSON.parse(body);
       sendMcpRequest(serverName, 'tools/call', { name: toolName, arguments: args }).then(r => {
          res.writeHead(200); res.end(JSON.stringify(r));
       }).catch(e => { res.writeHead(500); res.end(JSON.stringify({error: e.message})); });
    });
    return;
  }
  if (pathname === '/api/mcp/servers' && req.method === 'GET') {
     res.writeHead(200); res.end(JSON.stringify(Array.from(mcpServers.keys())));
     return;
  }

  // STATIC SERVER
  let filePath = path.join(ROOT_DIR, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  fs.readFile(filePath, (error, content) => {
    if (error) { if(error.code == 'ENOENT') { res.writeHead(404); res.end('404'); } else { res.writeHead(500); res.end('Error'); } }
    else {
      res.writeHead(200, { 'Content-Type': contentType });
      if (contentType === 'text/html') res.end(content.toString().replace('</body>', INJECT_SCRIPT + '</body>'));
      else res.end(content);
    }
  });
});

server.listen(PORT, () => { console.log(`Bridge v6.0.0 (Direct Edit) running at ${PORT}`); });