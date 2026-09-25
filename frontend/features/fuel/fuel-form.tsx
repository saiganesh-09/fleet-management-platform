'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fuelApi, vehiclesApi, driversApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/empty-state';
import { formatCurrency } from '@/lib/utils';

const schema = z.object({
  vehicleId: z.string().uuid('Select a vehicle'),
  driverId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  fuelDate: z.string().min(1, 'Required'),
  fuelType: z.enum(['DIESEL', 'PETROL', 'CNG', 'LPG', 'ELECTRIC', 'HYBRID']),
  liters: z.coerce.number().positive('Required'),
  pricePerLiter: z.coerce.number().positive('Required'),
  odometer: z.coerce.number().min(0).optional().or(z.literal('').transform(() => undefined)),
  station: z.string().optional(),
});
type FormValues = z.input<typeof schema>;

const FUELS = ['DIESEL', 'PETROL', 'CNG', 'LPG', 'ELECTRIC', 'HYBRID'];

export function FuelForm({ defaultVehicleId, onDone }: { defaultVehicleId?: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: vehicles } = useQuery({ queryKey: ['vehicles', 'all'], queryFn: () => vehiclesApi.list({ limit: 100 }) });
  const { data: drivers } = useQuery({ queryKey: ['drivers', 'all'], queryFn: () => driversApi.list({ limit: 100 }) });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleId: defaultVehicleId,
      fuelDate: new Date().toISOString().slice(0, 10),
      fuelType: 'DIESEL',
    },
  });

  const liters = Number(watch('liters')) || 0;
  const price = Number(watch('pricePerLiter')) || 0;
  const total = liters * price;

  const mutation = useMutation({
    mutationFn: (values: FormValues) => fuelApi.create(schema.parse(values)),
    onSuccess: () => {
      toast.success('Fuel record added');
      qc.invalidateQueries({ queryKey: ['fuel'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-2 gap-4">
      <div>
        <Label>Vehicle *</Label>
        <Select value={watch('vehicleId') ?? ''} onValueChange={(v) => setValue('vehicleId', v)}>
          <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
          <SelectContent>
            {(vehicles?.items ?? []).map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}
          </SelectContent>
        </Select>
        <FieldError message={errors.vehicleId?.message} />
      </div>
      <div>
        <Label>Driver</Label>
        <Select value={watch('driverId') ?? ''} onValueChange={(v) => setValue('driverId', v)}>
          <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
          <SelectContent>
            {(drivers?.items ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Date *</Label>
        <Input type="date" {...register('fuelDate')} />
        <FieldError message={errors.fuelDate?.message} />
      </div>
      <div>
        <Label>Fuel type *</Label>
        <Select value={watch('fuelType')} onValueChange={(v) => setValue('fuelType', v as FormValues['fuelType'])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{FUELS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Litres *</Label>
        <Input type="number" step="0.01" {...register('liters')} />
        <FieldError message={errors.liters?.message} />
      </div>
      <div>
        <Label>Price per litre (₹) *</Label>
        <Input type="number" step="0.01" {...register('pricePerLiter')} />
        <FieldError message={errors.pricePerLiter?.message} />
      </div>
      <div>
        <Label>Odometer (km)</Label>
        <Input type="number" {...register('odometer')} />
      </div>
      <div>
        <Label>Fuel station</Label>
        <Input {...register('station')} />
      </div>
      <div className="col-span-2 flex items-center justify-between rounded-md bg-muted px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">Total cost (auto)</span>
        <span className="text-lg font-bold">{formatCurrency(total)}</span>
      </div>
      <DialogFooter className="col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Add record'}
        </Button>
      </DialogFooter>
    </form>
  );
}
