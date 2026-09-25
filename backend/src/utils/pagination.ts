import { Request } from 'express';

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export function parsePageParams(req: Request, allowedSorts: string[] = []): PageParams {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));
  const search = req.query.search ? String(req.query.search).trim() : undefined;
  let sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
  if (sortBy && allowedSorts.length && !allowedSorts.includes(sortBy)) sortBy = undefined;
  const sortOrder = String(req.query.sortOrder ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  return { page, limit, skip: (page - 1) * limit, search, sortBy, sortOrder };
}
