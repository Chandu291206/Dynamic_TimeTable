const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/database');
const { importTimetableJson } = require('../src/services/timetable-json.service');

async function main() {
  const filePath = path.resolve(__dirname, '../../all_classes_combined_valid.json');
  console.log('Reading from:', filePath);

  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const entries = Array.isArray(data) ? data : [data];

  console.log(`Starting import of ${entries.length} timetables...`);

  const results = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const res = await importTimetableJson(entry, { db: prisma });
      console.log(`✓ [${i + 1}/${entries.length}] Imported: Y${res.classRoom.year} - ${res.classRoom.branch} - ${res.classRoom.section} (${res.importedSlotsCount} slots)`);
      results.push({ success: true, class: res.classRoom, slots: res.importedSlotsCount });
    } catch (err) {
      console.error(`✗ [${i + 1}/${entries.length}] Failed [${entry.branch} - ${entry.semester}]:`, err.message);
      if (err.validationErrors) {
        console.error('Validation errors:', JSON.stringify(err.validationErrors, null, 2));
      }
      results.push({ success: false, error: err.message });
    }
  }

  console.log('\n--- Import Summary ---');
  console.log(`Total: ${entries.length}, Successful: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
