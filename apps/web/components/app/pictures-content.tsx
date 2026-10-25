"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, MoreVertical, Sparkles, Upload } from "lucide-react";
import { AppCard } from "@/components/app/card";
import { AppEmptyState } from "@/components/app/empty-state";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { describeImageWithAi } from "@/lib/ai/actions";
import { processImageForUpload } from "@/lib/images/process";
import { formatBytes, publicMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export type MediaItem = {
  id: string;
  path: string;
  filename: string | null;
  mime: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  created_at: string | null;
};

type PicturesContentProps = {
  projectId: string;
  teamName: string;
  projectName: string;
  items: MediaItem[];
};

export function PicturesContent({ projectId, teamName, projectName, items }: PicturesContentProps) {
  const { toast } = useToast();
  const [media, setMedia] = React.useState<MediaItem[]>(items);
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [describeId, setDescribeId] = React.useState<string | null>(null);
  const [describing, setDescribing] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [savingDescription, setSavingDescription] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const processed = await processImageForUpload(file);
      const body = new FormData();
      body.append("file", new File([processed.blob], file.name, { type: processed.blob.type }));
      body.append("width", String(processed.width));
      body.append("height", String(processed.height));

      const res = await fetch(`/api/projects/${projectId}/media`, { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { media?: MediaItem } | null;
      if (!res.ok || !json?.media) {
        toast("We could not upload that picture. Please try again.", "error");
        return;
      }
      setMedia((prev) => [json.media as MediaItem, ...prev]);
      toast("Picture added.", "success");
    } catch {
      toast("That picture could not be added. Use a JPEG, PNG or WebP under 5 MB.", "error");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  async function remove() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/projects/${projectId}/media?id=${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast("We could not remove that picture. Please try again.", "error");
      return;
    }
    setMedia((prev) => prev.filter((item) => item.id !== deleteId));
    setDeleteId(null);
    toast("Picture removed.", "success");
  }

  async function describe(item: MediaItem) {
    setDescribing(true);
    setDescribeId(item.id);
    try {
      const result = await describeImageWithAi({
        projectId,
        mediaId: item.id,
      });
      if (!result.ok) {
        toast(result.message, "error");
        setDescribeId(null);
        return;
      }
      setDescription(result.text);
    } catch {
      toast("We could not describe that picture. Please try again.", "error");
      setDescribeId(null);
    } finally {
      setDescribing(false);
    }
  }

  async function saveDescription() {
    if (!describeId) return;
    setSavingDescription(true);
    const res = await fetch(`/api/projects/${projectId}/media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: describeId, alt: description }),
    });
    setSavingDescription(false);
    if (!res.ok) {
      toast("We could not save that description. Please try again.", "error");
      return;
    }
    setMedia((prev) =>
      prev.map((item) =>
        item.id === describeId ? { ...item, alt: description.trim() } : item,
      ),
    );
    setDescribeId(null);
    setDescription("");
    toast("Description saved.", "success");
  }

  const target = deleteId ? media.find((item) => item.id === deleteId) ?? null : null;
  const describeTarget = describeId
    ? media.find((item) => item.id === describeId) ?? null
    : null;

  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: teamName, href: "/dashboard" },
          { label: projectName, href: `/dashboard/projects/${projectId}` },
          { label: "Pictures" },
        ]}
        title="Pictures"
        description="Add and manage the pictures on your website."
        actions={
          <Button
            variant="primary"
            size="md"
            loading={uploading}
            loadingLabel="Uploading..."
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={20} strokeWidth={1.75} aria-hidden />
            Upload picture
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-primary bg-accent-soft" : "border-border-strong bg-surface",
        )}
      >
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent-text"
        >
          <ImagePlus size={28} strokeWidth={1.75} />
        </span>
        <p className="mt-4 text-base font-semibold text-text">Drag a picture here</p>
        <p className="mt-1 text-sm text-text-muted">JPEG, PNG or WebP up to 5 MB</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          Choose a file
        </Button>
      </div>

      {media.length === 0 ? (
        <div className="mt-6">
          <AppEmptyState
            compact
            icon={<ImagePlus size={32} strokeWidth={1.75} aria-hidden />}
            title="No pictures yet"
            description="Upload your first picture and it will show up here."
          />
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {media.map((item) => (
            <li key={item.id}>
              <AppCard className="p-0">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-card bg-surface-muted">
                  <Image
                    src={publicMediaUrl(item.path)}
                    alt={item.filename ?? "Picture"}
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 320px, (min-width: 480px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-text">
                      {item.filename ?? "Picture"}
                    </p>
                    <p className="text-xs text-text-muted">{formatBytes(item.size_bytes)}</p>
                  </div>
                  <Menu
                    label={`Actions for ${item.filename ?? "picture"}`}
                    trigger={(triggerProps) => (
                      <button
                        type="button"
                        {...triggerProps}
                        aria-label={`More actions for ${item.filename ?? "picture"}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-surface-muted"
                      >
                        <MoreVertical size={20} strokeWidth={1.75} aria-hidden />
                      </button>
                    )}
                  >
                    <MenuItem
                      onClick={() => {
                        setDescription(item.alt ?? "");
                        setDescribeId(item.id);
                      }}
                    >
                      Edit description
                    </MenuItem>
                    <MenuItem
                      onClick={() => void describe(item)}
                      disabled={describing}
                    >
                      <Sparkles size={16} strokeWidth={1.75} aria-hidden />
                      Describe with AI
                    </MenuItem>
                    <MenuItem
                      onClick={() =>
                        toast("Add images to pages from the editor view or Images library.", "info")
                      }
                    >
                      Use on page
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem destructive onClick={() => setDeleteId(item.id)}>
                      Delete
                    </MenuItem>
                  </Menu>
                </div>
              </AppCard>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={describeTarget !== null}
        onClose={() => {
          if (describing || savingDescription) return;
          setDescribeId(null);
          setDescription("");
        }}
        title="Picture description"
        width="form"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setDescribeId(null);
                setDescription("");
              }}
              type="button"
              disabled={describing || savingDescription}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => void saveDescription()}
              loading={savingDescription}
              loadingLabel="Saving..."
              type="button"
              disabled={describing || description.trim().length === 0}
            >
              Save description
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-text-muted">
          Tell people who cannot see the picture what it shows.
        </p>
        <div className="mt-4">
          <Label htmlFor="picture-description">Description</Label>
          <Textarea
            id="picture-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={160}
            placeholder="For example: A bright bakery counter with fresh bread."
            disabled={describing}
            className="mt-1.5 min-h-[96px]"
          />
          <p className="mt-1.5 text-sm text-text-muted">
            {description.length} of 160 characters
          </p>
        </div>
        {describing ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-text-muted" role="status">
            <Sparkles size={16} strokeWidth={1.75} aria-hidden />
            Describing...
          </p>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={target !== null}
        title="Delete this picture?"
        description={
          target
            ? `“${target.filename ?? "This picture"}” will be removed from your website.`
            : undefined
        }
        confirmLabel="Delete picture"
        destructive
        loading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setDeleteId(null)}
      />
    </AppPage>
  );
}
