'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface CollegeResponse {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  college_domains: [{ count: number }];
  campuses: [{ count: number }];
}

export interface DomainResponse {
  id: string;
  college_id: string;
  domain: string;
  is_active: boolean;
  created_at: string;
}

export interface CampusResponse {
  id: string;
  college_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export function useAdminColleges() {
  return useQuery<CollegeResponse[]>({
    queryKey: ['admin', 'colleges'],
    queryFn: () => api.get('/api/admin/colleges').then(r => r.data),
  });
}

export function useAdminCampuses(collegeId: string) {
  return useQuery<CampusResponse[]>({
    queryKey: ['admin', 'campuses', collegeId],
    queryFn: () => api.get(`/api/admin/colleges/${collegeId}/campuses`).then(r => r.data),
    enabled: !!collegeId,
  });
}

export function useCreateCollege() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      api.post<CollegeResponse>('/api/admin/colleges', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'colleges'] }),
  });
}

export function useUpdateCollege() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; is_active?: boolean }) =>
      api.patch<CollegeResponse>(`/api/admin/colleges/${id}`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'colleges'] }),
  });
}

export function useCreateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collegeId, domain }: { collegeId: string; domain: string }) =>
      api.post<DomainResponse>(`/api/admin/colleges/${collegeId}/domains`, { domain }).then(r => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['admin', 'domains', vars.collegeId] }),
  });
}

export function useUpdateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collegeId, domainId, ...body }: { collegeId: string; domainId: string; is_active?: boolean; domain?: string }) =>
      api.patch<DomainResponse>(`/api/admin/colleges/${collegeId}/domains/${domainId}`, body).then(r => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['admin', 'domains', vars.collegeId] }),
  });
}

export function useCreateCampus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collegeId, name }: { collegeId: string; name: string }) =>
      api.post<CampusResponse>(`/api/admin/colleges/${collegeId}/campuses`, { name }).then(r => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'campuses', vars.collegeId] });
      qc.invalidateQueries({ queryKey: ['admin', 'colleges'] });
    },
  });
}

export function useUpdateCampus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collegeId, campusId, ...body }: { collegeId: string; campusId: string; name?: string; is_active?: boolean }) =>
      api.patch<CampusResponse>(`/api/admin/colleges/${collegeId}/campuses/${campusId}`, body).then(r => r.data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['admin', 'campuses', vars.collegeId] }),
  });
}

export function useAdminDomains(collegeId: string) {
  return useQuery<DomainResponse[]>({
    queryKey: ['admin', 'domains', collegeId],
    queryFn: () => api.get(`/api/admin/colleges/${collegeId}/domains`).then(r => r.data),
    enabled: !!collegeId,
  });
}
