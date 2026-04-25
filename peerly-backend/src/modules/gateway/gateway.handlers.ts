import type { Socket, Namespace } from 'socket.io';
import { saveMessage } from '../messages/messages.service';
import { getMemberRole } from '../communities/communities.service';
import { SendMessageSchema } from '../messages/messages.types';
import { logger } from '../../lib/logger';

export function registerHandlers(socket: Socket, ns: Namespace): void {
  socket.on('join_room', async (payload: unknown) => {
    const communityId = (payload as Record<string, unknown>)?.communityId;
    if (typeof communityId !== 'string' || !communityId) {
      socket.emit('error', { message: 'communityId is required' });
      return;
    }
    try {
      const role = await getMemberRole(communityId, socket.data.user.userId);
      if (!role) { socket.emit('error', { message: 'Not a member' }); return; }
      socket.join(communityId);
    } catch (err) {
      logger.error('join_room error', { error: err });
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('leave_room', (payload: unknown) => {
    const communityId = (payload as Record<string, unknown>)?.communityId;
    if (typeof communityId !== 'string' || !communityId) return;
    socket.leave(communityId);
  });

  socket.on('send_message', async (payload: unknown) => {
    try {
      const parsed = SendMessageSchema.safeParse(payload);
      if (!parsed.success) { socket.emit('error', { message: 'Invalid payload' }); return; }

      const { communityId, content, image_url } = parsed.data;
      const role = await getMemberRole(communityId, socket.data.user.userId);
      if (!role) { socket.emit('error', { message: 'Not a member' }); return; }

      const message = await saveMessage({
        communityId,
        senderId: socket.data.user.userId,
        content,
        image_url,
      });
      ns.to(communityId).emit('new_message', message);
    } catch (err) {
      logger.error('send_message error', { error: err });
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing', (payload: unknown) => {
    const communityId = (payload as Record<string, unknown>)?.communityId;
    if (typeof communityId !== 'string' || !communityId) return;
    socket.to(communityId).emit('typing_indicator', {
      communityId,
      username: socket.data.user.username,
    });
  });
}
