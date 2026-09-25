'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { vehiclesApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/empty-state';
import type { Vehicle } from '@/types';

const schema = z.object({
  vehicleNumber: z.string().min(3, 'Required'),
  registrationNumber: z.string().min(3, 'Required'),
  vehicleType: z.enum(['TRUCK', 'VAN', 'CAR', 'BUS', 'MINIBUS', 'TRAILER', 'PICKUP', 'OTHER']),
  manufacturer: z.string().min(1, 'Required'),
  model: z.string().min(1, 'Required'),
  manufacturingYear: z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  fuelType: z.enum(['DIESEL', 'PETROL', 'CNG', 'LPG', 'ELECTRIC', 'HYBRID']),
  capacity: z.coerce.number().positive().optional().or(z.literal('').transform(() => undefined)),
  currentOdometer: z.coerce.number().min(0).default(0),
  purchaseDate: z.string().optional().or(z.literal('').transform(() => undefined)),
});
type FormValues = z.input<typeof schema>;

const TYPES = ['TRUCK', 'VAN', 'CAR', 'BUS', 'MINIBUS', 'TRAILER', 'PICKUP', 'OTHER'];
const FUELS = ['DIESEL', 'PETROL', 'CNG', 'LPG', 'ELECTRIC', 'HYBRID'];

export function VehicleForm({ vehicle, onDone }: { vehicle?: Vehicle; onDone: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!vehicle;
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: vehicle ? {
      vehicleNumber: vehicle.vehicleNumber,
      registrationNumber: vehicle.registrationNumber,
      vehicleType: vehicle.vehicleType,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      manufacturingYear: vehicle.manufacturingYear,
      fuelType: vehicle.fuelType,
      capacity: vehicle.capacity,
      currentOdometer: vehicle.currentOdometer,
      purchaseDate: vehicle.purchaseDate?.slice(0, 10),
    } : { vehicleType: 'TRUCK', fuelType: 'DIESEL', manufacturingYear: new Date().getFullYear(), currentOdometer: 0 },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit ? vehiclesApi.update(vehicle.id, schema.parse(values)) : vehiclesApi.create(schema.parse(values) as Partial<Vehicle>),
    onSuccess: () => {
      toast.success(isEdit ? 'Vehicle updated' : 'Vehicle added');
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-2 gap-4">
      <div>
        <Label>Vehicle number *</Label>
        <Input placeholder="TS09A1234" {...register('vehicleNumber')} />
        <FieldError message={errors.vehicleNumber?.message} />
      </div>
      <div>
        <Label>Registration number *</Label>
        <Input placeholder="TS-09-AX-1000" {...register('registrationNumber')} />
        <FieldError message={errors.registrationNumber?.message} />
      </div>
      <div>
        <Label>Type *</Label>
        <Select value={watch('vehicleType')} onValueChange={(v) => setValue('vehicleType', v as FormValues['vehicleType'])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Fuel type *</Label>
        <Select value={watch('fuelType')} onValueChange={(v) => setValue('fuelType', v as FormValues['fuelType'])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{FUELS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Manufacturer *</Label>
        <Input placeholder="Tata" {...register('manufacturer')} />
        <FieldError message={errors.manufacturer?.message} />
      </div>
      <div>
        <Label>Model *</Label>
        <Input placeholder="Ace Gold" {...register('model')} />
        <FieldError message={errors.model?.message} />
      </div>
      <div>
        <Label>Year *</Label>
        <Input type="number" {...register('manufacturingYear')} />
        <FieldError message={errors.manufacturingYear?.message} />
      </div>
      <div>
        <Label>Capacity (tons)</Label>
        <Input type="number" step="0.1" {...register('capacity')} />
      </div>
      <div>
        <Label>Odometer (km)</Label>
        <Input type="number" {...register('currentOdometer')} />
      </div>
      <div>
        <Label>Purchase date</Label>
        <Input type="date" {...register('purchaseDate')} />
      </div>
      <DialogFooter className="col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add vehicle'}
        </Button>
      </DialogFooter>
    </form>
  );
}
