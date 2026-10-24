"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/app/card";
import { SettingsSection } from "@/components/app/settings-section";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveProjectSettings } from "@/app/dashboard/(shell)/projects/[projectId]/settings/actions";

type Props = {
  projectId: string;
  name: string;
  subdomain: string;
  phone: string;
  email: string;
  address: string;
  canEdit: boolean;
};

export function ProjectSettings({
  projectId,
  name,
  subdomain,
  phone,
  email,
  address,
  canEdit,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = React.useState({ name, phone, email, address });
  const [saving, setSaving] = React.useState(false);

  const dirty =
    values.name !== name ||
    values.phone !== phone ||
    values.email !== email ||
    values.address !== address;

  function update(field: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("phone", values.phone);
    formData.set("email", values.email);
    formData.set("address", values.address);
    const result = await saveProjectSettings(projectId, formData);
    setSaving(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Your website details are saved.", "success");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <AppCard className="p-6">
        <SettingsSection
          title="Website name"
          description="This appears in your header and on every page."
        >
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            className="mt-1.5"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            maxLength={60}
            readOnly={!canEdit}
            autoComplete="organization"
          />
        </SettingsSection>

        <SettingsSection
          title="Web address"
          description="Your website's address cannot be changed here yet."
        >
          <Label htmlFor="project-address">Address</Label>
          <Input
            id="project-address"
            className="mt-1.5"
            value={subdomain}
            suffix=".get-on.tech"
            readOnly
          />
        </SettingsSection>

        <SettingsSection
          title="Contact details"
          description="Shown in your footer and on contact sections."
        >
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            <div>
              <Label htmlFor="project-phone" optional>
                Phone
              </Label>
              <Input
                id="project-phone"
                className="mt-1.5"
                value={values.phone}
                onChange={(event) => update("phone", event.target.value)}
                maxLength={40}
                readOnly={!canEdit}
                autoComplete="tel"
              />
            </div>
            <div>
              <Label htmlFor="project-email" optional>
                Email
              </Label>
              <Input
                id="project-email"
                className="mt-1.5"
                type="email"
                value={values.email}
                onChange={(event) => update("email", event.target.value)}
                maxLength={200}
                readOnly={!canEdit}
                autoComplete="email"
              />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="project-location" optional>
              Address
            </Label>
            <Textarea
              id="project-location"
              className="mt-1.5 min-h-[96px]"
              value={values.address}
              onChange={(event) => update("address", event.target.value)}
              maxLength={200}
              readOnly={!canEdit}
              autoComplete="street-address"
            />
          </div>
        </SettingsSection>
      </AppCard>

      {canEdit ? (
        <div className="mt-5 flex justify-end">
          <Button type="submit" size="md" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      ) : null}
    </form>
  );
}
