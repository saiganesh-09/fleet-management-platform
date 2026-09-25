'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi, driversApi } from '@/services/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { FieldError } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';

const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type PwValues = z.infer<typeof pwSchema>;

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const isDriver = user?.role === 'DRIVER';

  const { data: driverProfile } = useQuery({
    queryKey: ['my-driver-profile'],
    queryFn: () => driversApi.myProfile(),
    enabled: isDriver,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<PwValues>({ resolver: zodResolver(pwSchema) });

  const changePassword = async (v: PwValues) => {
    setSubmitting(true);
    try {
      await authApi.changePassword(v.currentPassword, v.newPassword);
      toast.success('Password changed — please sign in again');
      await logout();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const dp = driverProfile?.data;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account and driver profile</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">Name</span><span className="font-medium">{user?.name}</span></div>
          <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">Email</span><span className="font-medium">{user?.email}</span></div>
          <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">Role</span><StatusBadge status={user?.role ?? ''} /></div>
          <div className="flex justify-between py-2"><span className="text-muted-foreground">Member since</span><span className="font-medium">{formatDate(user?.createdAt)}</span></div>
        </CardContent>
      </Card>

      {isDriver && dp && (
        <Card>
          <CardHeader><CardTitle className="text-base">Driver profile</CardTitle><CardDescription>Linked employee record</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">Employee ID</span><span className="font-medium">{dp.employeeId}</span></div>
            <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">License</span><span className="font-medium">{dp.licenseNumber}</span></div>
            <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">License expiry</span><span className="font-medium">{formatDate(dp.licenseExpiry)}</span></div>
            <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">Status</span><StatusBadge status={dp.status} /></div>
            <div className="flex justify-between py-2"><span className="text-muted-foreground">Trips completed</span><span className="font-medium">{dp.stats?.completedTrips ?? 0}</span></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Change password</CardTitle><CardDescription>You will be signed out on all sessions</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(changePassword)} className="grid max-w-sm gap-4">
            <div><Label>Current password</Label><Input type="password" {...register('currentPassword')} /><FieldError message={errors.currentPassword?.message} /></div>
            <div><Label>New password</Label><Input type="password" {...register('newPassword')} /><FieldError message={errors.newPassword?.message} /></div>
            <div><Label>Confirm new password</Label><Input type="password" {...register('confirm')} /><FieldError message={errors.confirm?.message} /></div>
            <Button disabled={submitting} className="w-fit">{submitting ? 'Updating…' : 'Update password'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
