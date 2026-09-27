'use client';
import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Field } from './field';
import { api } from '@/lib/api';
import type { Identity } from '@/lib/contracts';

export function AuthDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (s: Identity) => Promise<void>;
}) {
  const [mode, setMode] = useState('login'),
    [form, setForm] = useState({
      name: '',
      organization_name: '',
      email: '',
      password: '',
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'reset') {
        await api('/auth/password-reset/request', { email: form.email });
        setError('If this account exists, a reset message has been requested.');
        return;
      }
      const body =
        mode === 'login'
          ? { email: form.email, password: form.password }
          : { ...form, locale: 'en-CH' };
      const result = await api<Identity>(
        '/auth/' + (mode === 'login' ? 'login' : 'register'),
        body,
      );
      setForm({ ...form, password: '' });
      await onSuccess(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="auth-dialog">
        <DialogHeader>
          <DialogTitle>
            {mode === 'register'
              ? 'Create your workspace'
              : mode === 'reset'
                ? 'Reset your password'
                : 'Welcome to HelveticLens'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'register'
              ? 'Registration creates a private organization. Invite colleagues once you are signed in.'
              : 'Use your existing HelveticLens account. Your workspace permissions apply here.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="form-stack">
          {mode === 'register' && (
            <>
              <Field label="Your name">
                <Input
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Organization">
                <Input
                  autoComplete="organization"
                  value={form.organization_name}
                  onChange={(e) =>
                    setForm({ ...form, organization_name: e.target.value })
                  }
                />
              </Field>
            </>
          )}
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          {mode !== 'reset' && (
            <Field
              label="Password"
              hint={
                mode === 'register' ? 'Use at least 12 characters.' : undefined
              }
            >
              <Input
                type="password"
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                minLength={mode === 'register' ? 12 : 1}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          <Button type="submit" className="primary-cta" disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : null}
            {mode === 'register'
              ? 'Create account'
              : mode === 'reset'
                ? 'Request reset email'
                : 'Sign in'}
          </Button>
          <div className="auth-links">
            <Button
              variant="link"
              onClick={() => {
                setError('');
                setMode(mode === 'register' ? 'login' : 'register');
              }}
            >
              {mode === 'register'
                ? 'Already have an account?'
                : 'Create an account'}
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setError('');
                setMode(mode === 'reset' ? 'login' : 'reset');
              }}
            >
              {mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
