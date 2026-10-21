"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateTeamName } from "@/app/dashboard/(shell)/team/actions";

export type TeamNameFormProps = {
  teamName: string;
  canEdit: boolean;
};

/** Team name setting (spec §6.3). */
export function TeamNameForm({ teamName, canEdit }: TeamNameFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = React.useState(teamName);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const changed = value.trim() !== teamName;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("name", value);
    const result = await updateTeamName(formData);
    setSaving(false);
    if (result.ok) {
      toast("Team name saved.", "success");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  if (!canEdit) {
    return (
      <div>
        <Label htmlFor="team-name-readonly">Team name</Label>
        <Input
          id="team-name-readonly"
          className="mt-1.5"
          value={teamName}
          readOnly
          disabled
        />
        <p className="mt-1.5 text-sm text-text-muted">
          Only the owner and admins can rename this team.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="max-w-[420px]">
      <Label htmlFor="team-name">Team name</Label>
      <Input
        id="team-name"
        className="mt-1.5"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={error ?? undefined}
        autoComplete="off"
      />
      <Button
        type="submit"
        variant="primary"
        size="md"
        className="mt-4"
        disabled={!changed}
        loading={saving}
        loadingLabel="Saving..."
      >
        Save
      </Button>
    </form>
  );
}
