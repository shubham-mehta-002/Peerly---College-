'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';

export interface PostResponse {
  id: string;
  content: string;
  image_urls: string[];
  is_global: boolean;
  is_anonymous: boolean;
  upvotes: number;
  comment_count: number;
  heat_score: number;
  created_at: string;
  campus_id: string;
  display_author: { username: string; name: string | null; avatar_url: string | null };
  user_vote: 'up' | 'down' | null;
}

type SortOption = 'latest' | 'oldest' | 'upvoted' | 'trending';

export function useCampusFeed(sort: SortOption = 'trending') {
  return useQuery<PostResponse[]>({
    queryKey: ['feed', 'campus', sort],
    queryFn: () => api.get(`/api/posts/campus?sort=${sort}`).then(r => r.data),
  });
}

export function useGlobalFeed(sort: SortOption = 'trending') {
  return useQuery<PostResponse[]>({
    queryKey: ['feed', 'global', sort],
    queryFn: () => api.get(`/api/posts/global?sort=${sort}`).then(r => r.data),
  });
}

export function usePost(id: string) {
  return useQuery<PostResponse>({
    queryKey: ['post', id],
    queryFn: () => api.get(`/api/posts/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

function applyVote(post: PostResponse, voteType: 'up' | 'down' | null): PostResponse {
  const prev = post.user_vote;
  const upvoteDelta = (voteType === 'up' ? 1 : 0) - (prev === 'up' ? 1 : 0);
  return { ...post, upvotes: post.upvotes + upvoteDelta, user_vote: voteType };
}

export function useVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, voteType }: { postId: string; voteType: 'up' | 'down' | null }) =>
      api.post(`/api/posts/${postId}/vote`, { vote_type: voteType }),
    onMutate: async ({ postId, voteType }) => {
      await qc.cancelQueries({ queryKey: ['post', postId] });
      await qc.cancelQueries({ queryKey: ['feed'] });

      const prevPost = qc.getQueryData<PostResponse>(['post', postId]);
      if (prevPost) {
        qc.setQueryData<PostResponse>(['post', postId], applyVote(prevPost, voteType));
      }

      const prevFeeds = new Map<unknown[], PostResponse[]>();
      qc.getQueriesData<PostResponse[]>({ queryKey: ['feed'] }).forEach(([key, posts]) => {
        if (!posts) return;
        prevFeeds.set(key as unknown[], posts);
        qc.setQueryData<PostResponse[]>(key as unknown[], posts.map(p => p.id === postId ? applyVote(p, voteType) : p));
      });

      return { prevPost, prevFeeds };
    },
    onError: (_err, { postId }, ctx) => {
      if (ctx?.prevPost) qc.setQueryData(['post', postId], ctx.prevPost);
      ctx?.prevFeeds?.forEach((posts, key) => qc.setQueryData(key as unknown[], posts));
    },
    onSettled: (_data, _err, { postId }) => {
      qc.invalidateQueries({ queryKey: ['post', postId] });
    },
  });
}

// Local-first vote with 600ms debounce before hitting backend.
// useEffect syncs server state back after invalidation settles.
export function usePostVote(post: PostResponse) {
  const [localVote, setLocalVote] = useState<'up' | 'down' | null>(post.user_vote);
  const [localUpvotes, setLocalUpvotes] = useState(post.upvotes);
  const vote = useVote();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only sync if no pending debounce — otherwise server response would stomp in-flight clicks
    if (!timer.current) {
      setLocalVote(post.user_vote);
      setLocalUpvotes(post.upvotes);
    }
  }, [post.user_vote, post.upvotes]);

  const handleVote = useCallback((type: 'up' | 'down') => {
    const next: 'up' | 'down' | null = localVote === type ? null : type;
    const delta = (next === 'up' ? 1 : 0) - (localVote === 'up' ? 1 : 0);
    setLocalVote(next);
    setLocalUpvotes(v => v + delta);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      vote.mutate({ postId: post.id, voteType: next });
    }, 600);
  }, [localVote, post.id, vote]);

  return { localVote, localUpvotes, handleVote };
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { content: string; image_urls: string[]; is_global: boolean; is_anonymous: boolean }) =>
      api.post<PostResponse>('/api/posts', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.delete(`/api/posts/${postId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  });
}
