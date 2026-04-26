'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface CommentResponse {
  id: string;
  parent_id: string | null;
  depth: number;
  content: string;
  created_at: string;
  author: { username: string; avatar_url: string | null };
}

export function useComments(postId: string) {
  return useQuery<CommentResponse[]>({
    queryKey: ['comments', postId],
    queryFn: () => api.get(`/api/posts/${postId}/comments`).then(r => r.data),
    enabled: !!postId,
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, content, parent_id }: { postId: string; content: string; parent_id?: string }) =>
      api.post<CommentResponse>(`/api/posts/${postId}/comments`, { content, parent_id }).then(r => r.data),
    onSuccess: (_data, { postId }) => {
      qc.invalidateQueries({ queryKey: ['comments', postId] });
      qc.invalidateQueries({ queryKey: ['post', postId] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, commentId }: { postId: string; commentId: string }) =>
      api.delete(`/api/posts/${postId}/comments/${commentId}`),
    onSuccess: (_data, { postId }) => {
      qc.invalidateQueries({ queryKey: ['comments', postId] });
    },
  });
}
