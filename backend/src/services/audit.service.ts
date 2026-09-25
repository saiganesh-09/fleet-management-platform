import { auditRepository } from '../repositories/misc.repository';
import { PageParams } from '../utils/pagination';

export const auditService = {
  async list(params: PageParams, filters: { entity?: string; userId?: string }) {
    const { items, total } = await auditRepository.findMany(params, filters);
    return { items, total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) };
  },
};
