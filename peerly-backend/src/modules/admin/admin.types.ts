import { z } from 'zod';

export const createCollegeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export const updateCollegeSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
}).refine((d) => d.name !== undefined || d.is_active !== undefined, {
  message: 'At least one field (name or is_active) required',
});

export const createDomainSchema = z.object({
  domain: z.string().min(3, 'Domain is required').regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid domain format'),
});

export const updateDomainSchema = z.object({
  is_active: z.boolean().optional(),
  domain: z.string().min(3).regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid domain format').optional(),
}).refine(d => d.is_active !== undefined || d.domain !== undefined, {
  message: 'At least one field required',
});

export const createCampusSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export const updateCampusSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
}).refine((d) => d.name !== undefined || d.is_active !== undefined, {
  message: 'At least one field (name or is_active) required',
});

export type CreateCollegeBody = z.infer<typeof createCollegeSchema>;
export type UpdateCollegeBody = z.infer<typeof updateCollegeSchema>;
export type CreateDomainBody = z.infer<typeof createDomainSchema>;
export type UpdateDomainBody = z.infer<typeof updateDomainSchema>;
export type CreateCampusBody = z.infer<typeof createCampusSchema>;
export type UpdateCampusBody = z.infer<typeof updateCampusSchema>;
