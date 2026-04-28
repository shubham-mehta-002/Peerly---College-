import type { Request, Response } from 'express';
import { createReport, getAdminReports, hidePost } from './reports.service';
import { ReportPostSchema, AdminReportsQuerySchema } from './reports.types';

export async function reportPostHandler(req: Request, res: Response): Promise<void> {
  const parsed = ReportPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', errors: parsed.error.issues });
    return;
  }
  await createReport(req.params.id as string, req.user.userId, parsed.data.reason, parsed.data.custom_text);
  res.json({ success: true });
}

export async function getAdminReportsHandler(req: Request, res: Response): Promise<void> {
  const parsed = AdminReportsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', errors: parsed.error.issues });
    return;
  }
  const reports = await getAdminReports(parsed.data);
  res.json(reports);
}

export async function hidePostHandler(req: Request, res: Response): Promise<void> {
  await hidePost(req.params.id as string);
  res.json({ success: true });
}
