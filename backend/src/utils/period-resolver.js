/**
 * Resolves startPeriodId and endPeriodId from a list of Period records given slot startTime and endTime.
 * @param {string} startTime 'HH:MM'
 * @param {string} endTime 'HH:MM'
 * @param {Array<{id: number, order: number, startTime: string, endTime: string}>} periods
 * @returns {{ startPeriodId: number|null, endPeriodId: number|null }}
 */
function resolvePeriodsFromList(startTime, endTime, periods) {
  if (!periods || periods.length === 0) {
    return { startPeriodId: null, endPeriodId: null };
  }

  // 1. Direct exact match
  let start = periods.find((p) => p.startTime === startTime);
  if (!start) {
    // Period that contains or starts closest to startTime
    start = periods.find((p) => p.startTime <= startTime && p.endTime > startTime);
  }

  let end = periods.find((p) => p.endTime === endTime);
  if (!end) {
    // Period that contains or ends closest to endTime
    end = periods.find((p) => p.startTime < endTime && p.endTime >= endTime);
  }

  return {
    startPeriodId: start ? start.id : null,
    endPeriodId: end ? end.id : null,
  };
}

module.exports = { resolvePeriodsFromList };
