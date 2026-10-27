const fs = require('fs');

function parseClassInfo(semesterStr, branchStr) {
  let year = 1;
  const semLower = (semesterStr || '').toLowerCase();
  if (/(?:^|\b)(?:iv|4th|4)(?:\b|$)/i.test(semLower) || semLower.includes('iv year') || semLower.includes('year 4') || semLower.includes('year iv')) {
    year = 4;
  } else if (/(?:^|\b)(?:iii|3rd|3)(?:\b|$)/i.test(semLower) || semLower.includes('iii year') || semLower.includes('year 3') || semLower.includes('year iii')) {
    year = 3;
  } else if (/(?:^|\b)(?:ii|2nd|2)(?:\b|$)/i.test(semLower) || semLower.includes('ii year') || semLower.includes('year 2') || semLower.includes('year ii')) {
    year = 2;
  } else if (/(?:^|\b)(?:i|1st|1)(?:\b|$)/i.test(semLower) || semLower.includes('i year') || semLower.includes('year 1') || semLower.includes('year i')) {
    year = 1;
  }

  let str = (branchStr || '').trim();
  // Strip degree prefixes like "B.Tech", "B.Tech.", "BTech"
  str = str.replace(/^B\.?\s*Tech\.?\s+/i, '').trim();

  let branch = str;
  let section = 'A';

  // Match pattern: <branch> [-/–] (Section|Sec) <sec> OR <branch> (Section|Sec) <sec>
  const secRegex = /^(.*?)\s*(?:[-–]\s*)?(?:Section|Sec)\s*([A-Za-z0-9]+)$/i;
  const match = str.match(secRegex);
  if (match) {
    branch = match[1].replace(/[-–\s]+$/, '').trim() || 'CSE';
    section = match[2].trim().toUpperCase();
  } else {
    const parts = str.split(/\s+/);
    if (parts.length > 1) {
      branch = parts[0];
      section = parts.slice(1).join(' ').replace(/^[-–]\s*/, '').trim() || 'A';
    } else {
      branch = str || 'CSE';
      section = 'A';
    }
  }

  return { year, branch, section };
}

const raw = fs.readFileSync('../all_classes_combined_valid.json', 'utf8');
const data = JSON.parse(raw);

data.forEach((x, i) => {
  const info = parseClassInfo(x.semester, x.branch);
  console.log(`Entry ${i}: "${x.branch}" (${x.semester}) => Year: ${info.year}, Branch: "${info.branch}", Section: "${info.section}"`);
});

// Also test existing: "CSE I"
console.log('CSE I test =>', parseClassInfo('Year 3 Semester I', 'CSE I'));
