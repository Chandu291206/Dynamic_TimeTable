const app = require('./app');
const prisma = require('./config/database');
const { port } = require('./config/env');
const logger = require('./utils/logger');

const server = app.listen(port, () => {
  logger.info(`API listening on http://localhost:${port}`, { port });
});

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`, { signal });
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: reason?.message || String(reason), stack: reason?.stack });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { message: error.message, stack: error.stack });
  shutdown('UNCAUGHT_EXCEPTION');
});
