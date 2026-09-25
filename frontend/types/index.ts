export type Role = 'SUPER_ADMIN' | 'FLEET_MANAGER' | 'DRIVER' | 'VIEWER';
export type VehicleStatus = 'AVAILABLE' | 'ASSIGNED' | 'ON_TRIP' | 'MAINTENANCE' | 'INACTIVE';
export type DriverStatus = 'AVAILABLE' | 'ASSIGNED' | 'ON_TRIP' | 'ON_LEAVE' | 'INACTIVE';
export type TripStatus = 'SCHEDULED' | 'STARTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED' | 'DELAYED';
export type VehicleType = 'TRUCK' | 'VAN' | 'CAR' | 'BUS' | 'MINIBUS' | 'TRAILER' | 'PICKUP' | 'OTHER';
export type FuelType = 'DIESEL' | 'PETROL' | 'CNG' | 'LPG' | 'ELECTRIC' | 'HYBRID';
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type DocumentStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
export type NotificationType = 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
  driverProfile?: { id: string; employeeId: string } | null;
}

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  manufacturer: string;
  model: string;
  manufacturingYear: number;
  fuelType: FuelType;
  capacity?: number;
  currentOdometer: number;
  status: VehicleStatus;
  purchaseDate?: string;
  assignedDriverId?: string | null;
  assignedDriver?: { id: string; name: string; employeeId: string; phone?: string } | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastSpeed?: number | null;
  lastLocationAt?: string | null;
  createdAt: string;
  trips?: Trip[];
  maintenanceRecords?: MaintenanceRecord[];
  fuelRecords?: FuelRecord[];
}

export interface Driver {
  id: string;
  employeeId: string;
  name: string;
  phone: string;
  email?: string;
  licenseNumber: string;
  licenseExpiry: string;
  experienceYears: number;
  status: DriverStatus;
  userId?: string | null;
  createdAt: string;
  assignedVehicles?: { id: string; vehicleNumber: string; vehicleType?: VehicleType; status?: VehicleStatus }[];
  trips?: Trip[];
  fuelRecords?: FuelRecord[];
  stats?: {
    totalTrips: number;
    completedTrips: number;
    cancelledTrips: number;
    distanceTravelled: number;
    licenseExpiresInDays: number;
  };
}

export interface Trip {
  id: string;
  tripNumber: string;
  vehicleId: string;
  driverId: string;
  vehicle?: { id: string; vehicleNumber: string; vehicleType?: VehicleType; status?: VehicleStatus };
  driver?: { id: string; name: string; employeeId?: string; phone?: string; status?: DriverStatus };
  source: string;
  destination: string;
  sourceLat?: number;
  sourceLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  startTime: string;
  expectedEndTime?: string;
  actualEndTime?: string;
  status: TripStatus;
  distance?: number;
  notes?: string;
  createdAt: string;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  vehicle?: { id: string; vehicleNumber: string; status?: VehicleStatus; currentOdometer?: number };
  serviceType: string;
  serviceDate: string;
  odometer?: number;
  nextServiceOdometer?: number;
  nextServiceDate?: string;
  cost: number;
  workshop?: string;
  description?: string;
  status: MaintenanceStatus;
  createdAt: string;
}

export interface FuelRecord {
  id: string;
  vehicleId: string;
  driverId?: string;
  vehicle?: { id: string; vehicleNumber: string; fuelType?: FuelType };
  driver?: { id: string; name: string; employeeId?: string };
  fuelDate: string;
  fuelType: FuelType;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  odometer?: number;
  station?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface FleetDocument {
  id: string;
  entityType: 'VEHICLE' | 'DRIVER';
  entityId: string;
  documentType: 'REGISTRATION' | 'INSURANCE' | 'PUC' | 'PERMIT' | 'DRIVING_LICENSE' | 'FITNESS_CERTIFICATE' | 'OTHER';
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  fileUrl?: string;
  status: DocumentStatus;
  computedStatus?: DocumentStatus;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

export interface LiveLocation {
  id: string;
  vehicleId?: string;
  vehicleNumber: string;
  status: VehicleStatus;
  lat?: number;
  lng?: number;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastSpeed?: number | null;
  lastLocationAt?: string | null;
  speed?: number;
  timestamp?: string;
  driver?: { id: string; name: string } | null;
  assignedDriver?: { id: string; name: string } | null;
  trips?: { id: string; tripNumber: string; status: TripStatus; destination: string }[];
  trip?: { id: string; status: TripStatus } | null;
}

export interface DashboardData {
  vehicles: { total: number; available: number; onTrip: number; maintenance: number; assigned: number; inactive: number };
  drivers: { total: number; available: number; onTrip: number };
  trips: { total: number; active: number; completed: number; delayed: number; cancelled: number };
  spend: { fuel: number; fuelLiters: number; maintenance: number; total: number };
  distanceTravelled: number;
  documentsExpiring: number;
}

export interface ChartsData {
  fuelByMonth: { month: string; cost: number; liters: number }[];
  maintenanceByMonth: { month: string; cost: number; count: number }[];
  tripsByMonth: { month: string; total: number; completed: number; cancelled: number; delayed: number }[];
  utilization: { total: number; busy: number; pct: number };
  vehicleUsage: { vehicleId: string; vehicleNumber: string; trips: number; distance: number }[];
  driverActivity: { driverId: string; driverName: string; trips: number }[];
}

export interface FuelEfficiency {
  vehicleId: string;
  vehicleNumber: string;
  avgEfficiency: number | null;
  recentEfficiency: number | null;
  records: number;
  anomaly: boolean;
}

export interface AuditLog {
  id: string;
  userId?: string;
  user?: { id: string; name: string; email: string } | null;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: string;
}
