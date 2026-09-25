'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { documentsApi, vehiclesApi, driversApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/empty-state';
import type { FleetDocument } from '@/types';

const schema = z.object({
  entityType: z.enum(['VEHICLE', 'DRIVER']),
  entityId: z.string().uuid('Select a vehicle/driver'),
  documentType: z.enum(['REGISTRATION', 'INSURANCE', 'PUC', 'PERMIT', 'DRIVING_LICENSE', 'FITNESS_CERTIFICATE', 'OTHER']),
  documentNumber: z.string().optional(),
  issueDate: z.string().optional().or(z.literal('').transform(() => undefined)),
  expiryDate: z.string().optional().or(z.literal('').transform(() => undefined)),
  fileUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
});
type FormValues = z.input<typeof schema>;

const DOC_TYPES = {
  VEHICLE: ['REGISTRATION', 'INSURANCE', 'PUC', 'PERMIT', 'FITNESS_CERTIFICATE', 'OTHER'],
  DRIVER: ['DRIVING_LICENSE', 'OTHER'],
} as const;

export function DocumentForm({ doc, defaultEntity, onDone }: {
  doc?: FleetDocument;
  defaultEntity?: { type: 'VEHICLE' | 'DRIVER'; id: string };
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!doc;
  const { data: vehicles } = useQuery({ queryKey: ['vehicles', 'all'], queryFn: () => vehiclesApi.list({ limit: 100 }) });
  const { data: drivers } = useQuery({ queryKey: ['drivers', 'all'], queryFn: () => driversApi.list({ limit: 100 }) });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: doc ? {
      entityType: doc.entityType,
      entityId: doc.entityId,
      documentType: doc.documentType,
      documentNumber: doc.documentNumber,
      issueDate: doc.issueDate?.slice(0, 10),
      expiryDate: doc.expiryDate?.slice(0, 10),
      fileUrl: doc.fileUrl,
    } : {
      entityType: defaultEntity?.type ?? 'VEHICLE',
      entityId: defaultEntity?.id,
      documentType: 'INSURANCE',
    },
  });

  const entityType = watch('entityType');
  const docTypes = DOC_TYPES[entityType ?? 'VEHICLE'];

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const v = schema.parse(values);
      return isEdit ? documentsApi.update(doc.id, v) : documentsApi.create(v);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Document updated' : 'Document added');
      qc.invalidateQueries({ queryKey: ['documents'] });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-2 gap-4">
      <div>
        <Label>Entity *</Label>
        <Select
          value={entityType}
          onValueChange={(v) => { setValue('entityType', v as 'VEHICLE' | 'DRIVER'); setValue('entityId', undefined as never); }}
          disabled={isEdit || !!defaultEntity}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="VEHICLE">Vehicle</SelectItem>
            <SelectItem value="DRIVER">Driver</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>{entityType === 'VEHICLE' ? 'Vehicle' : 'Driver'} *</Label>
        <Select value={watch('entityId') ?? ''} onValueChange={(v) => setValue('entityId', v)} disabled={isEdit || !!defaultEntity}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            {entityType === 'VEHICLE'
              ? (vehicles?.items ?? []).map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)
              : (drivers?.items ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name} · {d.employeeId}</SelectItem>)}
          </SelectContent>
        </Select>
        <FieldError message={errors.entityId?.message} />
      </div>
      <div>
        <Label>Document type *</Label>
        <Select value={watch('documentType')} onValueChange={(v) => setValue('documentType', v as FormValues['documentType'])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {docTypes.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Document number</Label>
        <Input {...register('documentNumber')} />
      </div>
      <div>
        <Label>Issue date</Label>
        <Input type="date" {...register('issueDate')} />
      </div>
      <div>
        <Label>Expiry date</Label>
        <Input type="date" {...register('expiryDate')} />
      </div>
      <div className="col-span-2">
        <Label>File URL</Label>
        <Input placeholder="https://files.example.com/…" {...register('fileUrl')} />
        <FieldError message={errors.fileUrl?.message} />
      </div>
      <DialogFooter className="col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add document'}
        </Button>
      </DialogFooter>
    </form>
  );
}
