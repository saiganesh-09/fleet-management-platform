'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tripsApi, vehiclesApi, driversApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/empty-state';

// Demo city coordinates — Hyderabad region
const PLACES: Record<string, { lat: number; lng: number }> = {
  'Hyderabad Depot': { lat: 17.385, lng: 78.4867 },
  'Secunderabad Hub': { lat: 17.4399, lng: 78.4983 },
  'HITEC City': { lat: 17.4435, lng: 78.3772 },
  'Shamshabad Airport': { lat: 17.2403, lng: 78.4294 },
  Warangal: { lat: 17.9689, lng: 79.5941 },
  Karimnagar: { lat: 18.4386, lng: 79.1288 },
  Vijayawada: { lat: 16.5062, lng: 80.648 },
  Nizamabad: { lat: 18.6725, lng: 78.0941 },
  Khammam: { lat: 17.2473, lng: 80.1514 },
  Gachibowli: { lat: 17.4401, lng: 78.3489 },
};

const schema = z.object({
  vehicleId: z.string().uuid('Select a vehicle'),
  driverId: z.string().uuid('Select a driver'),
  source: z.string().min(2, 'Required'),
  destination: z.string().min(2, 'Required'),
  startTime: z.string().min(1, 'Required'),
  expectedEndTime: z.string().optional().or(z.literal('').transform(() => undefined)),
  distance: z.coerce.number().positive().optional().or(z.literal('').transform(() => undefined)),
  notes: z.string().optional(),
});
type FormValues = z.input<typeof schema>;

function toLocalInput(d?: string | Date) {
  if (!d) return '';
  const date = new Date(d);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function TripForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { data: vehicles } = useQuery({ queryKey: ['vehicles', 'available'], queryFn: () => vehiclesApi.list({ status: 'AVAILABLE', limit: 100 }) });
  const { data: drivers } = useQuery({ queryKey: ['drivers', 'available'], queryFn: () => driversApi.list({ status: 'AVAILABLE', limit: 100 }) });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { startTime: toLocalInput(new Date(Date.now() + 3600_000)) },
  });

  const source = watch('source');
  const destination = watch('destination');

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const v = schema.parse(values);
      return tripsApi.create({
        ...v,
        sourceLat: PLACES[v.source]?.lat,
        sourceLng: PLACES[v.source]?.lng,
        destinationLat: PLACES[v.destination]?.lat,
        destinationLng: PLACES[v.destination]?.lng,
      });
    },
    onSuccess: () => {
      toast.success('Trip created and assigned');
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      qc.invalidateQueries({ queryKey: ['drivers'] });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const placeOptions = useMemo(() => Object.keys(PLACES), []);

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-2 gap-4">
      <div>
        <Label>Vehicle *</Label>
        <Select value={watch('vehicleId') ?? ''} onValueChange={(v) => setValue('vehicleId', v)}>
          <SelectTrigger><SelectValue placeholder="Select available vehicle" /></SelectTrigger>
          <SelectContent>
            {(vehicles?.items ?? []).map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.vehicleNumber} · {v.vehicleType}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.vehicleId?.message} />
        {!vehicles?.items.length && <p className="mt-1 text-xs text-muted-foreground">No available vehicles</p>}
      </div>
      <div>
        <Label>Driver *</Label>
        <Select value={watch('driverId') ?? ''} onValueChange={(v) => setValue('driverId', v)}>
          <SelectTrigger><SelectValue placeholder="Select available driver" /></SelectTrigger>
          <SelectContent>
            {(drivers?.items ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name} · {d.employeeId}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.driverId?.message} />
      </div>
      <div>
        <Label>Source *</Label>
        <Select value={source ?? ''} onValueChange={(v) => setValue('source', v)}>
          <SelectTrigger><SelectValue placeholder="Origin" /></SelectTrigger>
          <SelectContent>{placeOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
        <FieldError message={errors.source?.message} />
      </div>
      <div>
        <Label>Destination *</Label>
        <Select value={destination ?? ''} onValueChange={(v) => setValue('destination', v)}>
          <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
          <SelectContent>
            {placeOptions.filter((p) => p !== source).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <FieldError message={errors.destination?.message} />
      </div>
      <div>
        <Label>Start time *</Label>
        <Input type="datetime-local" {...register('startTime')} />
        <FieldError message={errors.startTime?.message} />
      </div>
      <div>
        <Label>Expected arrival</Label>
        <Input type="datetime-local" {...register('expectedEndTime')} />
      </div>
      <div>
        <Label>Distance (km)</Label>
        <Input type="number" step="0.1" {...register('distance')} />
      </div>
      <div className="col-span-2">
        <Label>Notes</Label>
        <Textarea rows={2} {...register('notes')} />
      </div>
      <DialogFooter className="col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create trip'}
        </Button>
      </DialogFooter>
    </form>
  );
}
