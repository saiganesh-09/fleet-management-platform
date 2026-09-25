'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { maintenanceApi, vehiclesApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/empty-state';
import type { MaintenanceRecord } from '@/types';

const schema = z.object({
  vehicleId: z.string().uuid('Select a vehicle'),
  serviceType: z.string().min(2, 'Required'),
  serviceDate: z.string().min(1, 'Required'),
  odometer: z.coerce.number().min(0).optional().or(z.literal('').transform(() => undefined)),
  nextServiceOdometer: z.coerce.number().min(0).optional().or(z.literal('').transform(() => undefined)),
  cost: z.coerce.number().min(0).default(0),
  workshop: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
});
type FormValues = z.input<typeof schema>;

const SERVICE_TYPES = ['Oil Change', 'Brake Service', 'Tire Rotation', 'Engine Inspection', 'Transmission Service', 'AC Service', 'Battery Replacement', 'Clutch Repair', 'Suspension Check', 'Full Service'];

export function MaintenanceForm({ record, defaultVehicleId, onDone }: { record?: MaintenanceRecord; defaultVehicleId?: string; onDone: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!record;
  const { data: vehicles } = useQuery({ queryKey: ['vehicles', 'all'], queryFn: () => vehiclesApi.list({ limit: 100 }) });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: record ? {
      vehicleId: record.vehicleId,
      serviceType: record.serviceType,
      serviceDate: record.serviceDate?.slice(0, 10),
      odometer: record.odometer,
      nextServiceOdometer: record.nextServiceOdometer,
      cost: record.cost,
      workshop: record.workshop,
      description: record.description,
      status: record.status,
    } : { vehicleId: defaultVehicleId, serviceDate: new Date().toISOString().slice(0, 10), status: 'SCHEDULED', cost: 0 },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const v = schema.parse(values);
      return isEdit ? maintenanceApi.update(record.id, v) : maintenanceApi.create(v);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Record updated' : 'Maintenance scheduled');
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-2 gap-4">
      <div>
        <Label>Vehicle *</Label>
        <Select value={watch('vehicleId') ?? ''} onValueChange={(v) => setValue('vehicleId', v)} disabled={isEdit}>
          <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
          <SelectContent>
            {(vehicles?.items ?? []).map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}
          </SelectContent>
        </Select>
        <FieldError message={errors.vehicleId?.message} />
      </div>
      <div>
        <Label>Service type *</Label>
        <Select value={watch('serviceType') ?? ''} onValueChange={(v) => setValue('serviceType', v)}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>{SERVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <FieldError message={errors.serviceType?.message} />
      </div>
      <div>
        <Label>Service date *</Label>
        <Input type="date" {...register('serviceDate')} />
        <FieldError message={errors.serviceDate?.message} />
      </div>
      <div>
        <Label>Status</Label>
        <Select value={watch('status')} onValueChange={(v) => setValue('status', v as FormValues['status'])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Odometer (km)</Label>
        <Input type="number" {...register('odometer')} />
      </div>
      <div>
        <Label>Next service at (km)</Label>
        <Input type="number" {...register('nextServiceOdometer')} />
      </div>
      <div>
        <Label>Cost (₹)</Label>
        <Input type="number" step="0.01" {...register('cost')} />
      </div>
      <div>
        <Label>Workshop</Label>
        <Input {...register('workshop')} />
      </div>
      <div className="col-span-2">
        <Label>Description</Label>
        <Textarea rows={2} {...register('description')} />
      </div>
      <DialogFooter className="col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Schedule service'}
        </Button>
      </DialogFooter>
    </form>
  );
}
