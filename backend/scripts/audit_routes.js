const fs = require('fs');
const path = require('path');

const routesDir = path.resolve(__dirname, '../src/routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const lines = content.split('\n');
  const routes = [];
  lines.forEach((line, i) => {
    const m = line.match(/router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/i);
    if (m) {
      routes.push(`${m[1].toUpperCase()} ${m[2]} (line ${i+1})`);
    }
  });
  console.log(`=== ${file} (${routes.length} endpoints) ===`);
  routes.forEach(r => console.log('  ', r));
});
