const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function getJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

test('CI Guard: No banned name-based lookups in services or controllers', () => {
  const servicesDir = path.resolve(__dirname, '../src/services');
  const controllersDir = path.resolve(__dirname, '../src/controllers');

  const files = [...getJsFiles(servicesDir), ...getJsFiles(controllersDir)];
  assert.ok(files.length > 0, 'Must inspect JavaScript files');

  const bannedPatterns = [
    /prisma\.faculty\.findFirst\(\s*\{\s*where:\s*\{[^}]*name\b/s,
    /prisma\.subject\.findFirst\(\s*\{\s*where:\s*\{[^}]*name\b/s,
    /prisma\.classRoom\.findFirst\(\s*\{\s*where:\s*\{[^}]*name\b/s,
  ];

  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of bannedPatterns) {
      if (pattern.test(content)) {
        violations.push({ file: path.relative(path.resolve(__dirname, '..'), file), pattern: pattern.toString() });
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Found banned name-based lookups in codebase: ${JSON.stringify(violations, null, 2)}`
  );
});
