"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import {
  updateMarketingConsent,
  updatePassword,
  updateProfile,
} from "@/app/dashboard/(shell)/account/actions";

/** Profile settings (spec §6.4). */
export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const { toast } = useToast();
  const [name, setName] = React.useState(fullName);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("fullName", name);
    const result = await updateProfile(formData);
    setSaving(false);
    if (result.ok) {
      toast("Your details were saved.", "success");
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={save} className="max-w-[420px]">
      <Label htmlFor="full-name">Full name</Label>
      <Input
        id="full-name"
        className="mt-1.5"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error ?? undefined}
        autoComplete="name"
      />

      <Label htmlFor="account-email" className="mt-4 block">
        Email
      </Label>
      <div className="relative mt-1.5">
        <Input
          id="account-email"
          value={email}
          readOnly
          disabled
          autoComplete="email"
          className="pr-11 text-text-muted"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-muted"
        >
          <Lock size={16} strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-1.5 text-sm text-text-muted">To change your email, contact support.</p>

      <Button
        type="submit"
        variant="primary"
        size="md"
        className="mt-5"
        disabled={name.trim() === fullName}
        loading={saving}
        loadingLabel="Saving..."
      >
        Save changes
      </Button>
    </form>
  );
}

/** Password settings (spec §6.4). */
export function PasswordForm() {
  const { toast } = useToast();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("password", password);
    formData.set("confirm", confirm);
    const result = await updatePassword(formData);
    setSaving(false);
    if (result.ok) {
      setPassword("");
      setConfirm("");
      toast("Your password was changed.", "success");
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={save} className="max-w-[420px]">
      <Label htmlFor="new-password">New password</Label>
      <PasswordInput
        id="new-password"
        className="mt-1.5"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
      />
      <Label htmlFor="confirm-password" className="mt-4 block">
        Confirm password
      </Label>
      <PasswordInput
        id="confirm-password"
        className="mt-1.5"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        autoComplete="new-password"
      />
      <p className="mt-1.5 text-sm text-text-muted">At least 8 characters.</p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger-text">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="secondary"
        size="md"
        className="mt-5"
        disabled={password.length === 0 || confirm.length === 0}
        loading={saving}
        loadingLabel="Saving..."
      >
        Update password
      </Button>
    </form>
  );
}

/** Marketing email preference (spec §6.4). */
export function MarketingPreference({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const [checked, setChecked] = React.useState(enabled);
  const [saving, setSaving] = React.useState(false);

  async function change(next: boolean) {
    const previous = checked;
    setChecked(next);
    setSaving(true);
    const result = await updateMarketingConsent(next);
    setSaving(false);
    if (result.ok) {
      toast(
        next ? "Marketing email is on." : "Marketing email is off.",
        "success",
      );
    } else {
      setChecked(previous);
      toast(result.error, "error");
    }
  }

  return (
    <Switch
      checked={checked}
      onCheckedChange={change}
      disabled={saving}
      label="Product news and tips"
      description="Occasional product news, tips and offers. Receipts and account messages are not affected."
    />
  );
}
