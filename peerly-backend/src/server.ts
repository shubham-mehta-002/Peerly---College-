import http from 'http';
import { config } from './config';
import { logger } from './lib/logger';
import app from './app';
import { createGateway } from './modules/gateway/gateway';

const httpServer = http.createServer(app);
createGateway(httpServer);

httpServer.listen(config.PORT, () => {
  logger.info('Server started', { port: config.PORT, env: config.NODE_ENV });
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
