import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';
import { reportService } from '../services/report.service';
import { fuelService } from '../services/fuel.service';
import { aiService } from '../services/ai.service';
import { ok } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const dateRange = (req: Request) => ({
  from: req.query.from ? new Date(String(req.query.from)) : undefined,
  to: req.query.to ? new Date(String(req.query.to)) : undefined,
});

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

// ---------- Analytics ----------

export const analyticsController = {
  dashboard: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = dateRange(req);
    ok(res, await analyticsService.dashboard(from, to));
  }),

  charts: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await analyticsService.charts());
  }),

  fuel: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await fuelService.efficiencyReport());
  }),
};

// ---------- Reports (JSON + CSV export) ----------

export const reportController = {
  fleet: asyncHandler(async (_req: Request, res: Response) => {
    const { json, csv } = await reportService.fleetReport();
    ok(res, { ...json, csv });
  }),

  fuel: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = dateRange(req);
    const { json, csv } = await reportService.fuelReport(from, to);
    if (req.query.format === 'csv') return sendCsv(res, 'fuel-report.csv', csv);
    ok(res, json);
  }),

  maintenance: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = dateRange(req);
    const { json, csv } = await reportService.maintenanceReport(from, to);
    if (req.query.format === 'csv') return sendCsv(res, 'maintenance-report.csv', csv);
    ok(res, json);
  }),

  trips: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = dateRange(req);
    const { json, csv } = await reportService.tripReport(from, to);
    if (req.query.format === 'csv') return sendCsv(res, 'trip-report.csv', csv);
    ok(res, json);
  }),
};

// ---------- AI proxy (authenticated user-facing) ----------

export const aiController = {
  ask: asyncHandler(async (req: Request, res: Response) => {
    const question = String(req.body?.question ?? '').trim();
    if (!question) return ok(res, { answer: 'Please ask a question.', toolUsed: null });
    const result = await aiService.ask(question, { name: req.user!.email, role: req.user!.role });
    ok(res, result);
  }),

  maintenanceRisk: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await aiService.maintenanceRisk(req.params.vehicleId));
  }),

  fuelAnomalies: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await aiService.fuelAnomalies());
  }),

  health: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await aiService.health());
  }),
};
