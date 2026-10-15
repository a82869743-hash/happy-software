const fs = require('fs');
const path = require('path');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'db_schema_dump.json')));
const routesDir = path.resolve(__dirname, '../src/routes');

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
let insertIssues = [];
let updateIssues = [];

files.forEach(file => {
  const code = fs.readFileSync(path.join(routesDir, file), 'utf8');
  
  // Clean comments
  const cleanCode = code.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1');

  // Check INSERT INTO table (col1, col2...)
  const insertRegex = /INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/gi;
  let match;
  while ((match = insertRegex.exec(cleanCode)) !== null) {
    const table = match[1].toLowerCase();
    if (!schema[table]) {
      insertIssues.push({ file, type: 'UNKNOWN_TABLE', table });
      continue;
    }
    const cols = match[2].split(',').map(c => c.trim().replace(/[`'"]/g, '').split(/\s+/)[0]);
    cols.forEach(col => {
      if (!col || col.toUpperCase().includes('SELECT') || col.includes('?') || col.toUpperCase().includes('VALUES')) return;
      if (!schema[table].includes(col)) {
        insertIssues.push({ file, table, col });
      }
    });
  }

  // Check UPDATE table SET col1 = ?, col2 = ?
  // Simple check for SET column =
  const setRegex = /UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([a-zA-Z0-9_,\s=?':`.]+?)(?:WHERE|ORDER|LIMIT|;|\n\s*\n)/gi;
  let setMatch;
  while ((setMatch = setRegex.exec(cleanCode)) !== null) {
    const table = setMatch[1].toLowerCase();
    if (!schema[table]) continue;
    const clause = setMatch[2];
    const assignments = clause.split(',');
    assignments.forEach(assign => {
      const parts = assign.split('=');
      if (parts.length === 2) {
        const col = parts[0].trim().replace(/[`'"]/g, '').split(/\s+/).pop();
        if (col && !col.includes('?') && !col.includes('(') && !col.includes('$') && !col.includes('+')) {
          if (!schema[table].includes(col)) {
            updateIssues.push({ file, table, col, clause: assign.trim() });
          }
        }
      }
    });
  }
});

console.log('--- INSERT ISSUES ---');
console.log(insertIssues);
console.log('--- UPDATE ISSUES ---');
console.log(updateIssues);
