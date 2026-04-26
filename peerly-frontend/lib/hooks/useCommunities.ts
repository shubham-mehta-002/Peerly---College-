'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface CommunityResponse {
  id: string;
  name: string;
  description: string | null;
  category: 'Technical' | 'Cultural' | 'Sports';
  is_global: boolean;
  campus_id: string;
  member_count: number;
  created_at: string;
  user_role: 'owner' | 'admin' | 'moderator' | 'member' | null;
}

export interface MemberResponse {
  user_id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joined_at: string;
}

export function isAdminRole(role: CommunityResponse['user_role']): boolean {
  return role === 'admin' || role === 'owner';
}

export function useCommunities(search?: string) {
  return useQuery<CommunityResponse[]>({
    queryKey: ['communities', search ?? ''],
    queryFn: () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      return api.get(`/api/communities${params}`).then(r => r.data);
    },
  });
}

export function useCommunity(id: string) {
  return useQuery<CommunityResponse>({
    queryKey: ['community', id],
    queryFn: () => api.get(`/api/communities/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCommunityMembers(communityId: string, enabled: boolean) {
  return useQuery<MemberResponse[]>({
    queryKey: ['community-members', communityId],
    queryFn: () => api.get(`/api/communities/${communityId}/members`).then(r => r.data),
    enabled: !!communityId && enabled,
  });
}

export function useJoinCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (communityId: string) => api.post(`/api/communities/${communityId}/join`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communities'] }),
  });
}

export function useLeaveCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (communityId: string) => api.post(`/api/communities/${communityId}/leave`),
    onSuccess: (_data, communityId) => {
      qc.invalidateQueries({ queryKey: ['communities'] });
      qc.invalidateQueries({ queryKey: ['community', communityId] });
    },
  });
}

export function useKickMember(communityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/api/communities/${communityId}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-members', communityId] });
      qc.invalidateQueries({ queryKey: ['community', communityId] });
    },
  });
}

export function useUpdateMemberRole(communityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'member' }) =>
      api.patch(`/api/communities/${communityId}/members/${userId}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-members', communityId] }),
  });
}

export function useDeleteCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (communityId: string) => api.delete(`/api/communities/${communityId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communities'] }),
  });
}

export function useCreateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; category: 'Technical' | 'Cultural' | 'Sports'; is_global?: boolean }) =>
      api.post<CommunityResponse>('/api/communities', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communities'] }),
  });
}
