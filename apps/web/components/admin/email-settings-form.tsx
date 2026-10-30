"use client";

import { useState } from "react";
import { saveEmailProvider } from "@/app/admin/(console)/email/actions";

const PROVIDERS = ["ses", "smtp", "console", "memory"] as const;

export type EmailSettingsFormProps = {
  initialProvider?: string;
  initialSmtp?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    from?: string;
    name?: string;
  };
};

export function EmailSettingsForm({
  initialProvider = "console",
  initialSmtp,
}: EmailSettingsFormProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>(initialProvider || "console");
  const [smtpHost, setSmtpHost] = useState(initialSmtp?.host ?? "");
  const [smtpPort, setSmtpPort] = useState<number>(initialSmtp?.port ?? 587);
  const [smtpSecure, setSmtpSecure] = useState<string>(initialSmtp?.secure ? "true" : "false");
  const [smtpUser, setSmtpUser] = useState(initialSmtp?.user ?? "");
  const [smtpFrom, setSmtpFrom] = useState(initialSmtp?.from ?? "");
  const [smtpName, setSmtpName] = useState(initialSmtp?.name ?? "Get-On");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await saveEmailProvider({
        provider: selectedProvider,
        smtp:
          selectedProvider === "smtp"
            ? {
                host: smtpHost,
                port: smtpPort,
                secure: smtpSecure === "true",
                user: smtpUser,
                from: smtpFrom,
                name: smtpName,
              }
            : undefined,
      });
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.error);
      }
    } catch {
      setError("We could not save the email settings.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSaved(false);
    setError(null);
    setSelectedProvider("console");
    setSmtpHost("");
    setSmtpPort(587);
    setSmtpSecure("false");
    setSmtpUser("");
    setSmtpFrom("");
    setSmtpName("Get-On");
  };

  return (
    <form className="mt-6 space-y-4 max-w-2xl" onSubmit={handleSave}>
      <div>
        <label className="text-sm font-medium text-text">Email provider</label>
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          className="mt-1 block w-full rounded-md border-input p-2"
        >
          {PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {provider[0].toUpperCase() + provider.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {selectedProvider === "smtp" && (
        <div>
          <div>
            <label className="text-sm font-medium text-text">SMTP Host</label>
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              className="mt-1 block w-full rounded-md border-input p-2"
              placeholder="smtp.example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm font-medium text-text">SMTP Port</label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-input p-2"
                min="1"
                placeholder="587"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text">SMTP Secure</label>
              <select
                value={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.value)}
                className="mt-1 block w-full rounded-md border-input p-2"
              >
                <option value="true">True (SSL/TLS)</option>
                <option value="false">False (STARTTLS)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-text">SMTP User</label>
            <input
              type="text"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              className="mt-1 block w-full rounded-md border-input p-2"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text">SMTP From</label>
            <input
              type="text"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              className="mt-1 block w-full rounded-md border-input p-2"
              placeholder="no-reply@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text">SMTP Name</label>
            <input
              type="text"
              value={smtpName}
              onChange={(e) => setSmtpName(e.target.value)}
              className="mt-1 block w-full rounded-md border-input p-2"
              placeholder="Get-On"
            />
          </div>
        </div>
      )}

      <div className="mt-6">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save email provider"}
        </button>
        <button
          type="button"
          onClick={resetForm}
          className="ml-2 rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary hover:bg-secondary/90"
        >
          Reset
        </button>
      </div>

      {error ? <p className="text-sm text-danger-text">{error}</p> : null}
      {saved ? <p className="text-sm text-success-text">Saved.</p> : null}
    </form>
  );
}
