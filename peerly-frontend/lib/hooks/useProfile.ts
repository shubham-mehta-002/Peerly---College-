'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ProfileResponse {
  id: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  campus_id: string | null;
  updated_at: string;
}

export function useMyProfile() {
  return useQuery<ProfileResponse>({
    queryKey: ['profile', 'me'],
    queryFn: () => api.get('/api/profile').then(r => r.data),
    staleTime: 2 * 60_000,
  });
}

export function usePublicProfile(username: string) {
  return useQuery<ProfileResponse>({
    queryKey: ['profile', username],
    queryFn: () => api.get(`/api/profile/${encodeURIComponent(username)}`).then(r => r.data),
    enabled: !!username && username !== 'me',
    staleTime: 2 * 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; bio?: string; avatar_url?: string }) =>
      api.patch<ProfileResponse>('/api/profile', body).then(r => r.data),
    onSuccess: data => {
      qc.setQueryData(['profile', 'me'], data);
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
