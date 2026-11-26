/**
 * Shared identity normalization utilities.
 * Ensures consistent natural key formatting across scraper, forms, importer, and seed.
 */

function normalizeStaffId(staffId) {
  if (!staffId) return null;
  const clean = String(staffId).trim().toUpperCase().replace(/[\s\u00A0]+/g, '');
  if (!clean) return null;
  // If purely numeric, strip leading zeroes so "0486" and "486" match seamlessly
  if (/^\d+$/.test(clean)) {
    const num = parseInt(clean, 10);
    return Number.isFinite(num) ? String(num) : clean;
  }
  return clean;
}

function normalizeSubjectCode(code) {
  if (!code) return null;
  const clean = String(code).trim().toUpperCase().replace(/\s+/g, ' ');
  return clean || null;
}

function normalizeClassTuple({ year, branch, section, academicYear }) {
  return {
    year: parseInt(year, 10),
    branch: (branch || '').trim().toUpperCase(),
    section: (section || '').trim().toUpperCase(),
    academicYear: (academicYear || '2026-27').trim().toUpperCase(),
  };
}

module.exports = {
  normalizeStaffId,
  normalizeSubjectCode,
  normalizeClassTuple,
};
