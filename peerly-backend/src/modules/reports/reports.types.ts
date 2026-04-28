import { z } from 'zod';

export const REPORT_REASONS = ['spam', 'harassment', 'misinformation', 'inappropriate', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];

export const ReportPostSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  custom_text: z.string().min(1).max(500).optional(),
}).refine(
  data => data.reason !== 'other' || (data.custom_text && data.custom_text.trim().length > 0),
  { message: 'custom_text is required when reason is "other"', path: ['custom_text'] }
);

export const AdminReportsQuerySchema = z.object({
  reason: z.enum(REPORT_REASONS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ReportPostBody = z.infer<typeof ReportPostSchema>;
export type AdminReportsQuery = z.infer<typeof AdminReportsQuerySchema>;

export interface PostReportSummary {
  id: string;
  content: string;
  author: { username: string; name: string | null; avatar_url: string | null };
  created_at: string;
  report_count: number;
  is_hidden: boolean;
  reason_breakdown: Record<string, number>;
}
