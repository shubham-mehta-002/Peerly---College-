import { io, Socket } from 'socket.io-client';
import { getToken } from './auth-utils';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket || !socket.connected) {
    const token = getToken();
    socket = io(`${process.env.NEXT_PUBLIC_API_URL}/communities`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
