const fs = require('fs');
const { timetableJsonSchema } = require('../src/validators/timetable-json.schema.js');

const raw = fs.readFileSync('../all_classes_combined_valid.json', 'utf8');
const data = JSON.parse(raw);

console.log('Testing', data.length, 'entries:');
let allPassed = true;
data.forEach((entry, idx) => {
  const parsed = timetableJsonSchema.safeParse(entry);
  if (!parsed.success) {
    allPassed = false;
    console.log(`\nEntry ${idx} [${entry.branch} - ${entry.semester}] FAILED:`);
    parsed.error.issues.forEach((issue) => {
      console.log(`  Path: ${issue.path.join('.')} | Code: ${issue.code} | Message: ${issue.message}`);
    });
  } else {
    console.log(`Entry ${idx} [${entry.branch} - ${entry.semester}]: PASSED!`);
  }
});

console.log('\nResult: All 10 passed?', allPassed);
