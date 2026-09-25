import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  ON_TRIP: 'bg-indigo-100 text-indigo-800',
  MAINTENANCE: 'bg-amber-100 text-amber-800',
  INACTIVE: 'bg-slate-100 text-slate-600',
  ON_LEAVE: 'bg-orange-100 text-orange-800',
  SCHEDULED: 'bg-sky-100 text-sky-800',
  STARTED: 'bg-blue-100 text-blue-800',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-slate-100 text-slate-600',
  DELAYED: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  VALID: 'bg-emerald-100 text-emerald-800',
  EXPIRING_SOON: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('border-transparent', STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700', className)}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
