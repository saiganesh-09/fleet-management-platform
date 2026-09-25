import { api, apiList } from '@/lib/api';
import type {
  User, Vehicle, Driver, Trip, MaintenanceRecord, FuelRecord, FleetDocument,
  AppNotification, LiveLocation, DashboardData, ChartsData, FuelEfficiency, AuditLog,
} from '@/types';

// ---------- Auth ----------
export const authApi = {
  login: (email: string, password: string) =>
    api<{ data: { user: User; accessToken: string; refreshToken: string } }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  register: (input: { name: string; email: string; password: string; phone?: string }) =>
    api<{ data: { user: User; accessToken: string; refreshToken: string } }>('/auth/register', {
      method: 'POST', body: JSON.stringify(input),
    }),
  logout: (refreshToken?: string) =>
    api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  me: () => api<{ data: User }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  forgotPassword: (email: string) =>
    api<{ data: { message: string; resetToken?: string } }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
};

// ---------- Vehicles ----------
export const vehiclesApi = {
  list: (params?: Record<string, unknown>) => apiList<Vehicle>('/vehicles', params),
  get: (id: string) => api<{ data: Vehicle }>(`/vehicles/${id}`),
  create: (data: Partial<Vehicle>) => api<{ data: Vehicle }>('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Vehicle>) => api<{ data: Vehicle }>(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivate: (id: string) => api(`/vehicles/${id}`, { method: 'DELETE' }),
  assignDriver: (id: string, driverId: string | null) =>
    api<{ data: Vehicle }>(`/vehicles/${id}/assign-driver`, { method: 'POST', body: JSON.stringify({ driverId }) }),
  reportIssue: (id: string, description: string, severity: 'LOW' | 'NORMAL' | 'HIGH') =>
    api<{ data: unknown }>(`/vehicles/${id}/report-issue`, { method: 'POST', body: JSON.stringify({ description, severity }) }),
};

// ---------- Drivers ----------
export const driversApi = {
  list: (params?: Record<string, unknown>) => apiList<Driver>('/drivers', params),
  get: (id: string) => api<{ data: Driver }>(`/drivers/${id}`),
  myProfile: () => api<{ data: Driver | null }>('/drivers/me/profile'),
  create: (data: Partial<Driver>) => api<{ data: Driver }>('/drivers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Driver>) => api<{ data: Driver }>(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setStatus: (id: string, status: string) => api<{ data: Driver }>(`/drivers/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// ---------- Trips ----------
export const tripsApi = {
  list: (params?: Record<string, unknown>) => apiList<Trip>('/trips', params),
  mine: (params?: Record<string, unknown>) => apiList<Trip>('/trips/mine', params),
  get: (id: string) => api<{ data: Trip }>(`/trips/${id}`),
  create: (data: Record<string, unknown>) => api<{ data: Trip }>('/trips', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => api<{ data: Trip }>(`/trips/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  transition: (id: string, action: 'start' | 'transit' | 'complete' | 'cancel' | 'delay', odometer?: number) =>
    api<{ data: Trip }>(`/trips/${id}/${action}`, { method: 'PUT', body: JSON.stringify(odometer != null ? { odometer } : {}) }),
};

// ---------- Maintenance ----------
export const maintenanceApi = {
  list: (params?: Record<string, unknown>) => apiList<MaintenanceRecord>('/maintenance', params),
  dashboard: () => api<{ data: {
    upcoming: MaintenanceRecord[]; overdue: MaintenanceRecord[]; dueByOdometer: MaintenanceRecord[];
    totalCost: number; totalRecords: number;
    costByVehicle: { vehicleId: string; vehicleNumber: string; cost: number; services: number }[];
  } }>('/maintenance/dashboard'),
  create: (data: Record<string, unknown>) => api<{ data: MaintenanceRecord }>('/maintenance', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => api<{ data: MaintenanceRecord }>(`/maintenance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ---------- Fuel ----------
export const fuelApi = {
  list: (params?: Record<string, unknown>) => apiList<FuelRecord>('/fuel', params),
  create: (data: Record<string, unknown>) => api<{ data: FuelRecord }>('/fuel', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/fuel/${id}`, { method: 'DELETE' }),
  efficiency: () => api<{ data: FuelEfficiency[] }>('/fuel/efficiency'),
};

// ---------- Documents ----------
export const documentsApi = {
  list: (params?: Record<string, unknown>) => apiList<FleetDocument>('/documents', params),
  create: (data: Record<string, unknown>) => api<{ data: FleetDocument }>('/documents', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => api<{ data: FleetDocument }>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/documents/${id}`, { method: 'DELETE' }),
};

// ---------- Notifications ----------
export const notificationsApi = {
  list: (params?: Record<string, unknown>) =>
    api<{ data: AppNotification[]; meta: { total: number; page: number; totalPages: number } & { unread?: number } }>('/notifications', { params: params as Record<string, string> }),
  markRead: (id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => api('/notifications/read-all', { method: 'PATCH' }),
};

// ---------- Analytics / reports ----------
export const analyticsApi = {
  dashboard: (params?: { from?: string; to?: string }) => api<{ data: DashboardData }>('/analytics/dashboard', { params }),
  charts: () => api<{ data: ChartsData }>('/analytics/charts'),
};
export const reportsApi = {
  fleet: () => api<{ data: { total: number; rows: Record<string, unknown>[]; csv: string } }>('/reports/fleet'),
  fuel: (format?: string) => api<{ data: { total: number; totalCost: number; totalLiters: number; rows: Record<string, unknown>[] } }>('/reports/fuel', { params: { format } }),
  maintenance: (format?: string) => api<{ data: { total: number; totalCost: number; rows: Record<string, unknown>[] } }>('/reports/maintenance', { params: { format } }),
  trips: (format?: string) => api<{ data: { total: number; byStatus: Record<string, number>; rows: Record<string, unknown>[] } }>('/reports/trips', { params: { format } }),
  downloadCsv: async (report: 'fleet' | 'fuel' | 'maintenance' | 'trips') => {
    // returns CSV text; fleet endpoint embeds csv in JSON
    if (report === 'fleet') {
      const res = await reportsApi.fleet();
      return res.data.csv;
    }
    return api<string>(`/reports/${report}`, { params: { format: 'csv' } });
  },
};

// ---------- Locations ----------
export const locationsApi = {
  live: () => api<{ data: LiveLocation[] }>('/locations/live'),
  history: (vehicleId: string, limit = 200) =>
    api<{ data: { latitude: number; longitude: number; speed: number; timestamp: string }[] }>(`/locations/${vehicleId}/history`, { params: { limit } }),
};

// ---------- Search ----------
export const searchApi = {
  global: (q: string) =>
    api<{ data: { vehicles: Vehicle[]; drivers: Driver[]; trips: Trip[]; documents: FleetDocument[] } }>('/search', { params: { q } }),
};

// ---------- Admin ----------
export const usersApi = {
  list: (params?: Record<string, unknown>) => apiList<User>('/users', params),
  create: (data: Record<string, unknown>) => api<{ data: User }>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => api<{ data: User }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
export const auditApi = {
  list: (params?: Record<string, unknown>) => apiList<AuditLog>('/audit-logs', params),
};

// ---------- AI ----------
export const aiApi = {
  ask: (question: string) =>
    api<{ data: { answer: string; toolUsed: string | null } }>('/ai/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  maintenanceRisk: (vehicleId: string) =>
    api<{ data: { risk: 'LOW' | 'MEDIUM' | 'HIGH'; score: number; reasons: string[]; summary?: string[]; disclaimer: string; vehicleNumber?: string } }>(`/ai/predictive-maintenance/${vehicleId}`),
  fuelAnomalies: () => api<{ data: { anomalies: { vehicleNumber: string; message: string; deviationPct: number }[] } }>('/ai/fuel-anomalies'),
};
