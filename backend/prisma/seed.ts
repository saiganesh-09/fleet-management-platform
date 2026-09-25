/**
 * Seed script — creates realistic demo data:
 *   5 users (one per role + extra), 20 vehicles, 15 drivers, 50 trips,
 *   40 maintenance records, 50 fuel records, documents in every expiry
 *   state, GPS locations.
 *
 * Run: npm run seed
 * Demo logins (password for all: Password123!):
 *   admin@example.com (SUPER_ADMIN)   manager@example.com (FLEET_MANAGER)
 *   driver@example.com (DRIVER)       viewer@example.com (VIEWER)
 */
import { PrismaClient, Role, VehicleType, FuelType, TripStatus, MaintenanceStatus, DocumentType, DocumentEntityType, DriverStatus, VehicleStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const rand = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));
const randF = (min: number, max: number, dp = 1) => parseFloat((min + Math.random() * (max - min)).toFixed(dp));
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

// Hyderabad-area locations used as trip endpoints
const PLACES = [
  { name: 'Hyderabad Depot', lat: 17.385, lng: 78.4867 },
  { name: 'Secunderabad Hub', lat: 17.4399, lng: 78.4983 },
  { name: 'HITEC City', lat: 17.4435, lng: 78.3772 },
  { name: 'Shamshabad Airport', lat: 17.2403, lng: 78.4294 },
  { name: 'Warangal', lat: 17.9689, lng: 79.5941 },
  { name: 'Karimnagar', lat: 18.4386, lng: 79.1288 },
  { name: 'Vijayawada', lat: 16.5062, lng: 80.648 },
  { name: 'Nizamabad', lat: 18.6725, lng: 78.0941 },
  { name: 'Khammam', lat: 17.2473, lng: 80.1514 },
  { name: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
];

const VEHICLE_MAKES: [string, string[]][] = [
  ['Tata', ['Ace Gold', 'Intra V30', '407', 'LPT 1613', 'Prima']],
  ['Ashok Leyland', ['Dost+', 'Ecomet 1615', 'Boss 1920']],
  ['Mahindra', ['Bolero Pik-Up', 'Supro', 'Furio 7']],
  ['Maruti Suzuki', ['Eeco Cargo', 'Super Carry']],
  ['Force', ['Traveller', 'Urbania']],
  ['Eicher', ['Pro 2049', 'Pro 3015']],
  ['Toyota', ['Innova Crysta', 'Hilux']],
];

const FIRST = ['Rahul', 'Amit', 'Priya', 'Suresh', 'Anita', 'Vikram', 'Kiran', 'Deepa', 'Ravi', 'Sneha', 'Arjun', 'Meena', 'Karthik', 'Lakshmi', 'Manoj'];
const LAST = ['Kumar', 'Sharma', 'Reddy', 'Verma', 'Rao', 'Naidu', 'Patel', 'Singh', 'Das', 'Iyer'];
const SERVICE_TYPES = ['Oil Change', 'Brake Service', 'Tire Rotation', 'Engine Inspection', 'Transmission Service', 'AC Service', 'Battery Replacement', 'Clutch Repair', 'Suspension Check', 'Full Service'];
const WORKSHOPS = ['FleetCare Auto', 'Highway Motors', 'City Service Center', 'MegaWorks Garage', 'QuickFix Auto'];
const STATIONS = ['IndianOil', 'HP Petrol', 'Bharat Petroleum', 'Reliance Fuel', 'Shell'];

async function main() {
  console.log('Seeding database...');

  // ---- Clean slate (dev only) ----
  await prisma.$transaction([
    prisma.gpsLocation.deleteMany(), prisma.notification.deleteMany(), prisma.auditLog.deleteMany(),
    prisma.fuelRecord.deleteMany(), prisma.maintenanceRecord.deleteMany(), prisma.trip.deleteMany(),
    prisma.document.deleteMany(), prisma.vehicle.deleteMany(), prisma.driver.deleteMany(),
    prisma.refreshToken.deleteMany(), prisma.passwordResetToken.deleteMany(), prisma.user.deleteMany(),
  ]);

  const password = await bcrypt.hash('Password123!', 10);

  // ---- Users ----
  const admin = await prisma.user.create({
    data: { name: 'Admin User', email: 'admin@example.com', passwordHash: password, role: 'SUPER_ADMIN', phone: '+91 90000 00001' },
  });
  const manager = await prisma.user.create({
    data: { name: 'Fleet Manager', email: 'manager@example.com', passwordHash: password, role: 'FLEET_MANAGER', phone: '+91 90000 00002' },
  });
  const driverUser = await prisma.user.create({
    data: { name: 'Demo Driver', email: 'driver@example.com', passwordHash: password, role: 'DRIVER', phone: '+91 90000 00003' },
  });
  await prisma.user.create({
    data: { name: 'Fleet Viewer', email: 'viewer@example.com', passwordHash: password, role: 'VIEWER', phone: '+91 90000 00004' },
  });
  await prisma.user.create({
    data: { name: 'Second Manager', email: 'manager2@example.com', passwordHash: password, role: 'FLEET_MANAGER', phone: '+91 90000 00005' },
  });

  // ---- Drivers ----
  const drivers = [] as Awaited<ReturnType<typeof prisma.driver.create>>[];
  for (let i = 0; i < 15; i++) {
    const name = `${FIRST[i]} ${rand(LAST)}`;
    drivers.push(
      await prisma.driver.create({
        data: {
          employeeId: `EMP-${String(1000 + i)}`,
          name: i === 0 ? 'Demo Driver' : name,
          phone: `+91 9${randInt(1000, 9999)} ${randInt(10000, 99999)}`,
          email: i === 0 ? 'driver@example.com' : `driver${i}@fleet.example.com`,
          licenseNumber: `TS${randInt(10, 99)}${randInt(100000, 999999)}`,
          licenseExpiry: daysFromNow(randInt(-20, 700)),
          experienceYears: randInt(1, 20),
          status: 'AVAILABLE',
          userId: i === 0 ? driverUser.id : null,
        },
      }),
    );
  }

  // ---- Vehicles ----
  const vehicles = [] as Awaited<ReturnType<typeof prisma.vehicle.create>>[];
  const types: VehicleType[] = ['TRUCK', 'TRUCK', 'VAN', 'VAN', 'CAR', 'PICKUP', 'MINIBUS', 'TRUCK', 'VAN', 'CAR', 'TRUCK', 'PICKUP', 'VAN', 'MINIBUS', 'TRUCK', 'CAR', 'VAN', 'TRUCK', 'PICKUP', 'BUS'];
  const fuels: FuelType[] = ['DIESEL', 'DIESEL', 'DIESEL', 'PETROL', 'PETROL', 'DIESEL', 'DIESEL', 'CNG', 'DIESEL', 'PETROL'];
  for (let i = 0; i < 20; i++) {
    const [make, models] = rand(VEHICLE_MAKES);
    vehicles.push(
      await prisma.vehicle.create({
        data: {
          vehicleNumber: `TS09${String.fromCharCode(65 + (i % 26))}${String(1000 + i * 7)}`,
          registrationNumber: `TS-09-${String.fromCharCode(65 + (i % 26))}X-${String(1000 + i)}`,
          vehicleType: types[i],
          manufacturer: make,
          model: rand(models),
          manufacturingYear: randInt(2016, 2024),
          fuelType: rand(fuels),
          capacity: randF(1, 18, 1),
          currentOdometer: randInt(15000, 120000),
          status: 'AVAILABLE',
          purchaseDate: daysAgo(randInt(100, 2500)),
          assignedDriverId: i < 10 ? drivers[i].id : null,
          lastLatitude: randF(17.2, 17.6, 5),
          lastLongitude: randF(78.2, 78.7, 5),
          lastLocationAt: new Date(),
          lastSpeed: 0,
        },
      }),
    );
  }

  // ---- Trips ----
  let completedCount = 0;
  const tripStatuses: TripStatus[] = [];
  for (let i = 0; i < 50; i++) {
    // Roughly: 32 completed, 5 cancelled, 3 delayed, 6 in-flight/scheduled, 4 scheduled
    if (i < 32) tripStatuses.push('COMPLETED');
    else if (i < 37) tripStatuses.push('CANCELLED');
    else if (i < 40) tripStatuses.push('DELAYED');
    else if (i < 44) tripStatuses.push('IN_TRANSIT');
    else tripStatuses.push('SCHEDULED');
  }
  const inTransitTrips: { vehicleIdx: number; src: (typeof PLACES)[number]; dst: (typeof PLACES)[number] }[] = [];

  for (let i = 0; i < 50; i++) {
    const status = tripStatuses[i];
    const vehicle = vehicles[i % vehicles.length];
    const driver = drivers[i % drivers.length];
    const src = rand(PLACES);
    let dst = rand(PLACES);
    if (dst.name === src.name) dst = PLACES[(PLACES.indexOf(src) + 1) % PLACES.length];
    const distance = randF(20, 350, 1);
    const startTime = status === 'SCHEDULED' ? daysFromNow(randInt(1, 5)) : daysAgo(randInt(1, 90));
    const expectedEnd = new Date(startTime.getTime() + randInt(2, 8) * 3_600_000);
    const actualEnd = status === 'COMPLETED' ? new Date(expectedEnd.getTime() + randInt(-1, 2) * 3_600_000)
      : ['CANCELLED', 'DELAYED'].includes(status) ? new Date(expectedEnd.getTime() + randInt(1, 6) * 3_600_000) : null;

    await prisma.trip.create({
      data: {
        tripNumber: `TRP-${String(i + 1).padStart(4, '0')}`,
        vehicleId: vehicle.id,
        driverId: driver.id,
        source: src.name,
        destination: dst.name,
        sourceLat: src.lat,
        sourceLng: src.lng,
        destinationLat: dst.lat,
        destinationLng: dst.lng,
        startTime,
        expectedEndTime: expectedEnd,
        actualEndTime: actualEnd,
        status,
        distance,
        notes: i % 5 === 0 ? 'Priority delivery' : null,
        createdById: manager.id,
      },
    });

    if (status === 'IN_TRANSIT') {
      inTransitTrips.push({ vehicleIdx: i % vehicles.length, src, dst });
      await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: 'ON_TRIP' } });
      await prisma.driver.update({ where: { id: driver.id }, data: { status: 'ON_TRIP' } });
    } else if (status === 'SCHEDULED') {
      await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: 'ASSIGNED', assignedDriverId: driver.id } });
      await prisma.driver.update({ where: { id: driver.id }, data: { status: 'ASSIGNED' } });
    } else if (status === 'COMPLETED') {
      completedCount++;
    }
  }

  // ---- Maintenance records ----
  for (let i = 0; i < 40; i++) {
    const vehicle = vehicles[i % vehicles.length];
    const status: MaintenanceStatus = i < 30 ? 'COMPLETED' : i < 35 ? 'SCHEDULED' : 'IN_PROGRESS';
    const serviceDate = status === 'SCHEDULED' ? daysFromNow(randInt(-10, 25)) : daysAgo(randInt(5, 300));
    const odo = Math.max(0, vehicle.currentOdometer - randInt(0, 20000));
    await prisma.maintenanceRecord.create({
      data: {
        vehicleId: vehicle.id,
        serviceType: rand(SERVICE_TYPES),
        serviceDate,
        odometer: odo,
        nextServiceOdometer: status === 'COMPLETED' ? odo + rand([8000, 10000, 12000, 15000]) : null,
        nextServiceDate: status === 'COMPLETED' ? new Date(serviceDate.getTime() + 180 * 86_400_000) : null,
        cost: randF(800, 25000, 0),
        workshop: rand(WORKSHOPS),
        description: rand(['Routine service', 'Driver reported noise', 'Preventive maintenance', 'Post-trip inspection finding', null]) as string | undefined,
        status,
      },
    });
    if (status === 'IN_PROGRESS') {
      await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: 'MAINTENANCE' } });
    }
  }

  // ---- Fuel records (odometer-ordered so efficiency can be computed) ----
  for (const vehicle of vehicles) {
    const count = randInt(2, 4);
    let odo = Math.max(1000, vehicle.currentOdometer - randInt(3000, 8000));
    for (let j = 0; j < count; j++) {
      const liters = randF(20, 90, 1);
      const ppl = randF(88, 105, 2);
      odo += randF(150, 600, 0);
      await prisma.fuelRecord.create({
        data: {
          vehicleId: vehicle.id,
          driverId: vehicle.assignedDriverId,
          fuelDate: daysAgo(randInt(1, 60)),
          fuelType: vehicle.fuelType,
          liters,
          pricePerLiter: ppl,
          totalCost: parseFloat((liters * ppl).toFixed(2)),
          odometer: Math.min(odo, vehicle.currentOdometer),
          station: rand(STATIONS),
        },
      });
    }
  }

  // ---- Documents — spread across VALID / EXPIRING_SOON / EXPIRED ----
  const docTypes: DocumentType[] = ['REGISTRATION', 'INSURANCE', 'PUC', 'PERMIT', 'FITNESS_CERTIFICATE'];
  const expiryOffsets = [400, 300, 500, 25, 15, 8, -5, -30, 45, 60]; // mixed states
  let di = 0;
  for (const vehicle of vehicles) {
    for (const dt of docTypes.slice(0, randInt(2, 4))) {
      const offset = expiryOffsets[di++ % expiryOffsets.length];
      await prisma.document.create({
        data: {
          entityType: 'VEHICLE' as DocumentEntityType,
          entityId: vehicle.id,
          documentType: dt,
          documentNumber: `${dt.slice(0, 3)}-${vehicle.vehicleNumber}-${randInt(1000, 9999)}`,
          issueDate: daysAgo(randInt(200, 800)),
          expiryDate: daysFromNow(offset),
          status: offset < 0 ? 'EXPIRED' : offset <= 30 ? 'EXPIRING_SOON' : 'VALID',
          fileUrl: `https://files.example.com/docs/${vehicle.vehicleNumber}/${dt.toLowerCase()}.pdf`,
        },
      });
    }
  }
  for (const driver of drivers.slice(0, 10)) {
    const offset = expiryOffsets[di++ % expiryOffsets.length];
    await prisma.document.create({
      data: {
        entityType: 'DRIVER',
        entityId: driver.id,
        documentType: 'DRIVING_LICENSE',
        documentNumber: driver.licenseNumber,
        issueDate: daysAgo(randInt(400, 1500)),
        expiryDate: driver.licenseExpiry,
        status: offset < 0 ? 'EXPIRED' : driver.licenseExpiry < daysFromNow(30) ? 'EXPIRING_SOON' : 'VALID',
      },
    });
  }

  // ---- GPS history for vehicles ----
  for (const v of vehicles) {
    const baseLat = v.lastLatitude ?? 17.385;
    const baseLng = v.lastLongitude ?? 78.4867;
    for (let j = 0; j < 5; j++) {
      await prisma.gpsLocation.create({
        data: {
          vehicleId: v.id,
          latitude: baseLat + randF(-0.02, 0.02, 5),
          longitude: baseLng + randF(-0.02, 0.02, 5),
          speed: v.status === 'ON_TRIP' ? randF(30, 70) : 0,
          timestamp: new Date(Date.now() - j * 60_000),
        },
      });
    }
  }

  // ---- A few notifications for demo users ----
  await prisma.notification.createMany({
    data: [
      { userId: admin.id, title: 'Welcome to FleetOps', message: 'Your fleet dashboard is ready. Demo data has been seeded.', type: 'INFO' },
      { userId: manager.id, title: 'Fleet overview', message: `${vehicles.length} vehicles and ${drivers.length} drivers loaded.`, type: 'INFO' },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    drivers: await prisma.driver.count(),
    vehicles: await prisma.vehicle.count(),
    trips: await prisma.trip.count(),
    maintenance: await prisma.maintenanceRecord.count(),
    fuel: await prisma.fuelRecord.count(),
    documents: await prisma.document.count(),
    gps: await prisma.gpsLocation.count(),
  };
  console.log('Seed complete:', counts);
  console.log('Completed trips:', completedCount);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
