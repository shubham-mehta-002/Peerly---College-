import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { gatewayAuth } from './gateway.auth';
import { registerHandlers } from './gateway.handlers';
import { setCommunityNs } from '../../lib/gateway-singleton';

export function createGateway(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: config.FRONTEND_URL, credentials: true },
  });

  const ns = io.of('/communities');
  setCommunityNs(ns);
  ns.use(gatewayAuth);

  ns.on('connection', (socket) => {
    logger.info('Socket connected', { userId: socket.data.user.userId });
    registerHandlers(socket, ns);
    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { userId: socket.data.user.userId });
    });
  });

  return io;
}
