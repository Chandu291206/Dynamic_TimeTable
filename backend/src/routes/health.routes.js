const router = require('express').Router();
const prisma = require('../config/database');

router.get('/health', async (req, res) => {
  let dbStatus = 'connected';
  let isHealthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'disconnected';
    isHealthy = false;
  }

  const payload = {
    status: isHealthy ? 'ok' : 'degraded',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatus,
    memory: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  };

  return res.status(isHealthy ? 200 : 503).json(payload);
});

module.exports = router;
