const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '../../frontend/src');

// Collect all backend routes
const routesDir = path.resolve(__dirname, '../src/routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
const serverJs = fs.readFileSync(path.resolve(__dirname, '../src/server.js'), 'utf8');

// Parse server.js mounts
const mounts = [];
const mountRegex = /app\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*require\(['"`]\.\/routes\/([^'"`]+)['"`]\)\)/g;
let m;
while ((m = mountRegex.exec(serverJs)) !== null) {
  mounts.push({ prefix: m[1], file: m[2] + '.js' });
}

// Add public route
mounts.push({ prefix: '/api/public', file: 'publicTracking.js' });

const backendEndpoints = [];
mounts.forEach(({ prefix, file }) => {
  const filePath = path.join(routesDir, file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach(line => {
    const routeMatch = line.match(/(?:router|r)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/i);
    if (routeMatch) {
      const method = routeMatch[1].toUpperCase();
      let pathPart = routeMatch[2];
      if (pathPart === '/') pathPart = '';
      backendEndpoints.push({
        method,
        fullPath: (prefix + pathPart).replace(/\/+/g, '/'),
        file
      });
    }
  });
});

console.log(`Loaded ${backendEndpoints.length} backend endpoints.`);

// Now recursively scan frontend/src for api calls
function scanDir(dir) {
  let files = [];
  fs.readdirSync(dir).forEach(item => {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      files = files.concat(scanDir(full));
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      files.push(full);
    }
  });
  return files;
}

const frontendFiles = scanDir(frontendDir);
const frontendCalls = [];

frontendFiles.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  // Match api.get('/path' ...), api.post(`/path` ...)
  const apiRegex = /api\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*[`'"]([^`'"?]+)/gi;
  let callMatch;
  while ((callMatch = apiRegex.exec(code)) !== null) {
    frontendCalls.push({
      file: path.relative(frontendDir, file),
      method: callMatch[1].toUpperCase(),
      url: callMatch[2]
    });
  }
});

console.log(`Found ${frontendCalls.length} frontend API calls.`);

// Match each frontend call against backend endpoints
function matchRoute(backendRoute, callUrl) {
  // Convert backend route parameters :param to regex
  const regexStr = '^' + backendRoute.replace(/:[a-zA-Z0-9_]+/g, '[^/]+') + '$';
  return new RegExp(regexStr).test(callUrl);
}

const unmatched = [];
frontendCalls.forEach(call => {
  // Normalize url
  let url = call.url;
  // If url doesn't start with /api, in axios baseURL is http://localhost:5000/api
  // But let's check whether frontend calls /api/... or just /...
  let normalizedUrl = url;
  if (!url.startsWith('/api')) {
    normalizedUrl = ('/api' + (url.startsWith('/') ? '' : '/') + url).replace(/\/+/g, '/');
  }

  // Check if any backend endpoint matches method + route
  const found = backendEndpoints.some(be => {
    if (be.method !== call.method) return false;
    return matchRoute(be.fullPath, normalizedUrl);
  });

  if (!found) {
    unmatched.push({
      file: call.file,
      method: call.method,
      rawUrl: call.url,
      normalizedUrl
    });
  }
});

console.log('\n--- UNMATCHED / POTENTIALLY BROKEN FRONTEND API CALLS ---');
console.log(`Total unmatched: ${unmatched.length}`);
console.log(JSON.stringify(unmatched, null, 2));
