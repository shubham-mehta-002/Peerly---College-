'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';

export interface MessageResponse {
  id: string;
  community_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  sender: { username: string; avatar_url: string | null };
  is_system?: boolean;
}

const PAGE_SIZE = 30;

export function useMessages(communityId: string) {
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const joined = useRef(false);
  const oldestId = useRef<string | undefined>(undefined);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle: only emit typing once per 1800ms so we don't spam on every keystroke
  const lastTypingEmit = useRef(0);

  // Initial load
  useEffect(() => {
    if (!communityId) return;
    setIsLoading(true);
    api.get(`/api/communities/${communityId}/messages?limit=${PAGE_SIZE}`)
      .then(r => {
        const data: MessageResponse[] = r.data;
        setMessages(data);
        setHasMore(data.length === PAGE_SIZE);
        if (data.length > 0) oldestId.current = data[0].id;
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [communityId]);

  // Socket setup
  useEffect(() => {
    if (!communityId) return;
    const socket = getSocket();

    const onConnect = () => {
      if (!joined.current) {
        socket.emit('join_room', { communityId });
        joined.current = true;
      }
    };

    const onNewMessage = (msg: MessageResponse) => {
      setMessages(prev => [...prev, msg]);
    };

    const onTyping = ({ username }: { username: string }) => {
      setTypingUser(username);
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      typingClearTimer.current = setTimeout(() => setTypingUser(null), 2000);
    };

    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    socket.on('new_message', onNewMessage);
    socket.on('typing_indicator', onTyping);

    return () => {
      socket.emit('leave_room', { communityId });
      socket.off('connect', onConnect);
      socket.off('new_message', onNewMessage);
      socket.off('typing_indicator', onTyping);
      joined.current = false;
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
    };
  }, [communityId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !oldestId.current) return;
    setIsLoadingMore(true);
    try {
      const r = await api.get(`/api/communities/${communityId}/messages?before=${oldestId.current}&limit=${PAGE_SIZE}`);
      const older: MessageResponse[] = r.data;
      if (older.length === 0) { setHasMore(false); return; }
      setMessages(prev => [...older, ...prev]);
      setHasMore(older.length === PAGE_SIZE);
      oldestId.current = older[0].id;
    } catch {}
    finally { setIsLoadingMore(false); }
  }, [communityId, hasMore, isLoadingMore]);

  const sendMessage = useCallback((content: string, image_url?: string) => {
    getSocket().emit('send_message', { communityId, content, ...(image_url ? { image_url } : {}) });
  }, [communityId]);

  // Throttled: emit on first keystroke, then at most once per 1800ms while typing continues.
  // Receiver clears typing indicator after 2000ms — so 1800ms keeps it alive without spam.
  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingEmit.current > 1800) {
      lastTypingEmit.current = now;
      getSocket().emit('typing', { communityId });
    }
  }, [communityId]);

  return { messages, isLoading, isLoadingMore, hasMore, loadMore, sendMessage, sendTyping, typingUser };
}
