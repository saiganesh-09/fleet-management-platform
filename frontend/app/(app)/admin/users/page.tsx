'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { usersApi } from '@/services/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState, FieldError } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import type { User, Role } from '@/types';

const ROLES: Role[] = ['SUPER_ADMIN', 'FLEET_MANAGER', 'DRIVER', 'VIEWER'];
const ROLE_TONE: Record<Role, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800',
  FLEET_MANAGER: 'bg-blue-100 text-blue-800',
  DRIVER: 'bg-teal-100 text-teal-800',
  VIEWER: 'bg-slate-100 text-slate-700',
};

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8).optional().or(z.literal('').transform(() => undefined)),
  role: z.enum(['SUPER_ADMIN', 'FLEET_MANAGER', 'DRIVER', 'VIEWER']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});
type FormValues = z.input<typeof schema>;

function UserDialog({ user, open, onClose }: { user?: User; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: user
      ? { name: user.name, email: user.email, phone: user.phone ?? '', role: user.role, status: user.status }
      : { role: 'VIEWER', status: 'ACTIVE' },
  });
  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      user ? usersApi.update(user.id, schema.parse(v)) : usersApi.create(schema.parse(v)),
    onSuccess: () => {
      toast.success(user ? 'User updated' : 'User created');
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{user ? `Edit ${user.name}` : 'Create user'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Name</Label><Input {...register('name')} /><FieldError message={errors.name?.message} /></div>
            <div><Label>Email</Label><Input type="email" {...register('email')} /><FieldError message={errors.email?.message} /></div>
            <div><Label>Phone</Label><Input {...register('phone')} /></div>
            {!user && <div><Label>Password</Label><Input type="password" {...register('password')} /><FieldError message={errors.password?.message} /></div>}
            <div>
              <Label>Role</Label>
              <Select value={watch('role')} onValueChange={(v) => setValue('role', v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={watch('status')} onValueChange={(v) => setValue('status', v as FormValues['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, role],
    queryFn: () => usersApi.list({ page, limit: 12, search: search || undefined, role: role || undefined }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users & Roles</h1>
          <p className="text-sm text-muted-foreground">Manage accounts and role-based access</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }}><Plus /> Create user</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="w-64 pl-8" placeholder="Search name / email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={role || 'ALL'} onValueChange={(v) => { setRole(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <TableSkeleton /> : !data?.items.length ? <EmptyState title="No users" /> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead><TableHead>Phone</TableHead><TableHead>Role</TableHead>
                <TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="font-medium">{u.name}</span>
                    {u.id === me?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>{u.phone ?? '—'}</TableCell>
                  <TableCell><Badge variant="outline" className={ROLE_TONE[u.role]}>{u.role.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell><StatusBadge status={u.status} /></TableCell>
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(u); setDialogOpen(true); }}><Pencil /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-3 pb-3">
            <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} total={data.meta?.total} onPage={setPage} />
          </div>
        </div>
      )}

      {dialogOpen && <UserDialog user={editing} open onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
