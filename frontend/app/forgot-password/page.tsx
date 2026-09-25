'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';
import { authApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [demoToken, setDemoToken] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword(email);
      setDemoToken(res.data.resetToken);
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-center gap-2 text-2xl font-bold text-primary">
          <Truck className="h-8 w-8" /> FleetOps
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>We will generate a password reset token for your account</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">If the email exists, a reset token was generated.</p>
                {demoToken && (
                  <div className="rounded-md border bg-muted p-3">
                    <p className="text-xs font-medium">Demo mode — your reset token:</p>
                    <code className="mt-1 block break-all text-xs">{demoToken}</code>
                    <Link className="mt-2 inline-block text-primary hover:underline" href={`/reset-password?token=${demoToken}`}>
                      Continue to reset →
                    </Link>
                  </div>
                )}
                <Link href="/login" className="block text-center text-primary hover:underline">Back to sign in</Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button className="w-full" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send reset token'}
                </Button>
                <Link href="/login" className="block text-center text-sm text-primary hover:underline">Back to sign in</Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
