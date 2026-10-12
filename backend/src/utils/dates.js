const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function getTimetableDay(date) {
  const jsDay = date.getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function todayAsIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { parseDate, getTimetableDay, todayAsIsoDate };
