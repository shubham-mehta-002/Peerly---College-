import { Request, Response } from 'express';
import * as adminService from './admin.service';

// All req.body fields pre-validated by Zod schemas via validateBody middleware

export async function createCollege(req: Request, res: Response): Promise<void> {
  const data = await adminService.createCollege(req.body.name);
  res.status(201).json(data);
}

export async function listColleges(_req: Request, res: Response): Promise<void> {
  const data = await adminService.listColleges();
  res.json(data);
}

export async function updateCollege(req: Request, res: Response): Promise<void> {
  const data = await adminService.updateCollege(req.params.id as string, req.body);
  res.json(data);
}

export async function createDomain(req: Request, res: Response): Promise<void> {
  const data = await adminService.createDomain(req.params.id as string, req.body.domain);
  res.status(201).json(data);
}

export async function listDomains(req: Request, res: Response): Promise<void> {
  const data = await adminService.listDomains(req.params.id as string);
  res.json(data);
}

export async function updateDomain(req: Request, res: Response): Promise<void> {
  const data = await adminService.updateDomain(req.params.id as string, req.params.domainId as string, req.body);
  res.json(data);
}

export async function createCampus(req: Request, res: Response): Promise<void> {
  const data = await adminService.createCampus(req.params.id as string, req.body.name);
  res.status(201).json(data);
}

export async function listCampuses(req: Request, res: Response): Promise<void> {
  const data = await adminService.listCampuses(req.params.id as string);
  res.json(data);
}

export async function updateCampus(req: Request, res: Response): Promise<void> {
  const data = await adminService.updateCampus(req.params.id as string, req.params.campusId as string, req.body);
  res.json(data);
}
