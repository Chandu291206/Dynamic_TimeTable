const { getLogs } = require('../services/timetable-log.service');

async function list(req, res) {
  const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500) : 100;
  const offset = req.query.offset ? Math.max(parseInt(req.query.offset, 10) || 0, 0) : 0;
  const logs = await getLogs({ limit, offset });
  return res.json({ success: true, data: logs });
}

module.exports = { list };
