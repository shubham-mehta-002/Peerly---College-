'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface PostReportSummary {
  id: string;
  content: string;
  author: { username: string; name: string | null; avatar_url: string | null };
  created_at: string;
  report_count: number;
  is_hidden: boolean;
  reason_breakdown: Record<string, number>;
}

export type ReportReason = 'spam' | 'harassment' | 'misinformation' | 'inappropriate' | 'other';

export function useReportPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, reason, customText }: { postId: string; reason: ReportReason; customText?: string }) =>
      api.post(`/api/posts/${postId}/report`, { reason, custom_text: customText }),
    onSuccess: (_data, { postId }) => {
      qc.invalidateQueries({ queryKey: ['post', postId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useAdminReports(reason?: string, page = 1) {
  return useQuery<PostReportSummary[]>({
    queryKey: ['admin-reports', reason ?? 'all', page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (reason) params.set('reason', reason);
      return api.get(`/api/admin/reports?${params}`).then(r => r.data);
    },
  });
}

export function useHidePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.patch(`/api/admin/posts/${postId}/hide`),
    onSuccess: (_data, postId) => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      qc.invalidateQueries({ queryKey: ['post', postId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useUnhidePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.patch(`/api/admin/posts/${postId}/unhide`),
    onSuccess: (_data, postId) => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      qc.invalidateQueries({ queryKey: ['post', postId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
