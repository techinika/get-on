"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_ERROR = "Please choose a PNG or JPG picture under 2 MB.";

export function StepContact({
  contact,
  onContactChange,
  logoData,
  logoError,
  onLogoChange,
  onLogoError,
  includeContactForm,
  onIncludeContactFormChange,
}: {
  contact: { phone: string; email: string; address: string };
  onContactChange: (contact: { phone: string; email: string; address: string }) => void;
  logoData: string | null;
  logoError: string | null;
  onLogoChange: (data: string | null) => void;
  onLogoError: (error: string | null) => void;
  includeContactForm: boolean;
  onIncludeContactFormChange: (value: boolean) => void;
}) {
  const changeInputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    if ((file.type !== "image/png" && file.type !== "image/jpeg") || file.size > MAX_LOGO_BYTES) {
      onLogoError(LOGO_ERROR);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onLogoError(null);
      onLogoChange(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => onLogoError(LOGO_ERROR);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="contact-phone">Phone</Label>
          <div className="mt-2">
            <Input
              id="contact-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={contact.phone}
              onChange={(event) => onContactChange({ ...contact, phone: event.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="contact-email">Email</Label>
          <div className="mt-2">
            <Input
              id="contact-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={contact.email}
              onChange={(event) => onContactChange({ ...contact, email: event.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="contact-address">Address</Label>
          <div className="mt-2">
            <Input
              id="contact-address"
              autoComplete="street-address"
              value={contact.address}
              onChange={(event) => onContactChange({ ...contact, address: event.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Label>Your logo (optional)</Label>
        {logoData ? (
          <div className="mt-2 flex items-center gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-info border border-border bg-surface p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- client-side data-URL preview */}
              <img src={logoData} alt="Your logo" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11"
                onClick={() => changeInputRef.current?.click()}
              >
                Change
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11"
                onClick={() => {
                  onLogoError(null);
                  onLogoChange(null);
                }}
              >
                Remove
              </Button>
            </div>
            <input
              ref={changeInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
        ) : (
          <label
            className={cn(
              "mt-2 flex h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-info border-2 border-dashed border-border-strong transition-colors",
              dragOver && "border-primary bg-primary-soft",
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              handleFile(event.dataTransfer.files?.[0]);
            }}
          >
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              onChange={(event) => {
                handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Upload size={28} strokeWidth={1.75} aria-hidden className="text-primary" />
            <span className="text-base font-semibold">Tap to add your logo</span>
            <span className="text-sm text-text-muted">PNG or JPG, up to 2 MB</span>
          </label>
        )}
        {logoError ? (
          <div className="mt-2">
            <FieldError>{logoError}</FieldError>
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-info border border-border p-4">
        <Switch
          checked={includeContactForm}
          onCheckedChange={onIncludeContactFormChange}
          label="Add a contact form to my homepage"
          description="Visitors can send you messages. You will get an email each time."
        />
      </div>
    </div>
  );
}
