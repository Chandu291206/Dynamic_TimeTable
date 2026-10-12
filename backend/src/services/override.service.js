const { sameTimeRange, timesOverlap } = require('../utils/time');

function chooseOverride(slot, overrides) {
  const overlaps = overrides.filter((override) => timesOverlap(override, slot));
  if (!overlaps.length) return null;

  const exactMatch = overlaps.find((override) => sameTimeRange(override, slot));
  return exactMatch || overlaps[0];
}

function applyOverrides(slots, overrides) {
  const orderedOverrides = [...overrides].sort((first, second) => {
    const firstDate = new Date(first.createdAt).getTime();
    const secondDate = new Date(second.createdAt).getTime();
    return secondDate - firstDate || second.id - first.id;
  });

  return slots.map((slot) => ({ ...slot, override: chooseOverride(slot, orderedOverrides) }));
}

module.exports = { applyOverrides, chooseOverride };
