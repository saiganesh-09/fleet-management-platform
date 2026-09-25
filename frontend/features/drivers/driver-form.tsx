'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { driversApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/empty-state';
import type { Driver } from '@/types';

const schema = z.object({
  employeeId: z.string().min(2, 'Required'),
  name: z.string().min(2, 'Required'),
  phone: z.string().min(7, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  licenseNumber: z.string().min(4, 'Required'),
  licenseExpiry: z.string().min(1, 'Required'),
  experienceYears: z.coerce.number().int().min(0).max(60).default(0),
});
type FormValues = z.input<typeof schema>;

export function DriverForm({ driver, onDone }: { driver?: Driver; onDone: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!driver;
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: driver ? {
      employeeId: driver.employeeId,
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      licenseNumber: driver.licenseNumber,
      licenseExpiry: driver.licenseExpiry?.slice(0, 10),
      experienceYears: driver.experienceYears,
    } : { experienceYears: 0 },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit ? driversApi.update(driver.id, schema.parse(values)) : driversApi.create(schema.parse(values)),
    onSuccess: () => {
      toast.success(isEdit ? 'Driver updated' : 'Driver added');
      qc.invalidateQueries({ queryKey: ['drivers'] });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-2 gap-4">
      <div>
        <Label>Employee ID *</Label>
        <Input placeholder="EMP-1001" {...register('employeeId')} />
        <FieldError message={errors.employeeId?.message} />
      </div>
      <div>
        <Label>Full name *</Label>
        <Input {...register('name')} />
        <FieldError message={errors.name?.message} />
      </div>
      <div>
        <Label>Phone *</Label>
        <Input {...register('phone')} />
        <FieldError message={errors.phone?.message} />
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" {...register('email')} />
        <FieldError message={errors.email?.message} />
      </div>
      <div>
        <Label>License number *</Label>
        <Input {...register('licenseNumber')} />
        <FieldError message={errors.licenseNumber?.message} />
      </div>
      <div>
        <Label>License expiry *</Label>
        <Input type="date" {...register('licenseExpiry')} />
        <FieldError message={errors.licenseExpiry?.message} />
      </div>
      <div>
        <Label>Experience (years)</Label>
        <Input type="number" {...register('experienceYears')} />
      </div>
      <DialogFooter className="col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add driver'}
        </Button>
      </DialogFooter>
    </form>
  );
}
