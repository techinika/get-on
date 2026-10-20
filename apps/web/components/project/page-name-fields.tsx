"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { FieldError, Input, Label } from "@/components/ui/input";

/** Turn a page name into its web address ("/about-us"). */
export function pathFromTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `/${slug}`;
}

/** Keep only the characters a web address allows. */
export function sanitizePath(raw: string): string {
  const body = raw
    .replace(/^\/+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
  return `/${body}`;
}

export type PageNameFieldsProps = {
  idPrefix: string;
  subdomain: string;
  title: string;
  onTitleChange: (value: string) => void;
  path: string;
  editingPath: boolean;
  onEditPath: () => void;
  onPathChange: (value: string) => void;
  pathError?: string;
};

export function PageNameFields({
  idPrefix,
  subdomain,
  title,
  onTitleChange,
  path,
  editingPath,
  onEditPath,
  onPathChange,
  pathError,
}: PageNameFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`${idPrefix}-title`}>Page name</Label>
        <Input
          id={`${idPrefix}-title`}
          className="mt-1.5"
          placeholder="For example: About us"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="rounded-input bg-surface-muted p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 break-all">
            <span className="text-text-muted">Web address: </span>
            <span>
              {subdomain}.get-on.tech
              <span className="font-semibold text-text">{path}</span>
            </span>
          </p>
          {editingPath ? null : (
            <button
              type="button"
              onClick={onEditPath}
              aria-label="Edit the web address"
              className="-my-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-border"
            >
              <Pencil size={16} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>

        {editingPath ? (
          <div className="mt-2">
            <Label htmlFor={`${idPrefix}-path`} className="sr-only">
              Page web address
            </Label>
            <Input
              id={`${idPrefix}-path`}
              className="h-11 text-sm"
              value={path}
              onChange={(event) => onPathChange(sanitizePath(event.target.value))}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-text-muted">Letters, numbers and dashes only.</p>
          </div>
        ) : null}
      </div>

      {pathError ? <FieldError>{pathError}</FieldError> : null}
    </div>
  );
}
