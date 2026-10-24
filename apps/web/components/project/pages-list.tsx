"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, GripVertical, House, Lock, MoreVertical, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppCard } from "@/components/app/card";
import { AppEmptyState } from "@/components/app/empty-state";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { AddPageDialog } from "@/components/project/add-page-dialog";
import { DeletePageDialog } from "@/components/project/delete-page-dialog";
import { RenamePageDialog } from "@/components/project/rename-page-dialog";
import type { PageRow } from "@/components/project/types";

const JSON_HEADERS = { "Content-Type": "application/json" };

type ApiResult = { ok: boolean; error: string | null; page?: PageRow };

async function send(path: string, init?: RequestInit): Promise<ApiResult> {
  try {
    const res = await fetch(path, init);
    const body = (await res.json().catch(() => null)) as
      | { error?: string; page?: PageRow }
      | null;
    if (!res.ok || body?.error) {
      return { ok: false, error: body?.error ?? "UNKNOWN" };
    }
    return { ok: true, error: null, page: body?.page };
  } catch {
    return { ok: false, error: "UNKNOWN" };
  }
}

export type PagesListProps = {
  project: { id: string; subdomain: string; name: string };
  teamName: string;
  planName: string;
  pageLimit: number | null;
  pages: PageRow[];
};

export function PagesList({ project, teamName, planName, pageLimit, pages }: PagesListProps) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<PageRow[]>(pages);

  const [addOpen, setAddOpen] = React.useState(false);
  const [renameId, setRenameId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const [armedId, setArmedId] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(`get-on-viewed-pages:${project.id}`, "1");
    } catch {
      // The checklist simply stays incomplete when storage is unavailable.
    }
  }, [project.id]);

  const used = items.length;
  const atLimit = pageLimit !== null && used >= pageLimit;
  const renamePage = renameId ? items.find((page) => page.id === renameId) ?? null : null;
  const deletePageRow = deleteId ? items.find((page) => page.id === deleteId) ?? null : null;

  async function patchPage(pageId: string, body: Record<string, unknown>): Promise<ApiResult> {
    return send(`/api/projects/${project.id}/pages/${pageId}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
  }

  async function rename(
    page: PageRow,
    title: string,
    path?: string,
  ): Promise<string | null> {
    const snapshot = items;
    const nextPath = path && path !== page.path ? path : page.path;
    setItems(
      items.map((row) => (row.id === page.id ? { ...row, title, path: nextPath } : row)),
    );
    const result = await patchPage(page.id, {
      title,
      ...(path && path !== page.path ? { path } : {}),
    });
    if (!result.ok) {
      setItems(snapshot);
      return friendlyError(result.error);
    }
    return null;
  }

  async function setHomepage(page: PageRow) {
    const snapshot = items;
    const previous = items.find((row) => row.is_homepage && row.id !== page.id);
    setItems(
      items.map((row) => {
        if (row.id === page.id) return { ...row, is_homepage: true, path: "/" };
        if (previous && row.id === previous.id) {
          return { ...row, is_homepage: false, path: "/home" };
        }
        return row;
      }),
    );
    const result = await patchPage(page.id, { isHomepage: true });
    if (!result.ok) {
      setItems(snapshot);
      toast(friendlyError(result.error), "error");
    }
  }

  async function removePage(page: PageRow) {
    const snapshot = items;
    setItems(items.filter((row) => row.id !== page.id));
    const result = await send(`/api/projects/${project.id}/pages/${page.id}`, {
      method: "DELETE",
    });
    if (!result.ok) {
      setItems(snapshot);
      toast(friendlyError(result.error), "error");
    }
  }

  async function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const snapshot = items;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    const ordered = next.map((row, index) => ({ ...row, position: index }));
    setItems(ordered);

    const dirty = ordered.filter(
      (row, index) => !snapshot[index] || snapshot[index].id !== row.id || snapshot[index].position !== index,
    );
    const results = await Promise.all(
      dirty.map((row) => patchPage(row.id, { position: row.position })),
    );
    const failed = results.find((result) => !result.ok);
    if (failed) {
      setItems(snapshot);
      toast(friendlyError(failed.error), "error");
    }
  }

  function clearDrag() {
    setDragId(null);
    setOverId(null);
    setArmedId(null);
  }

  function handleDrop(targetId: string) {
    if (!dragId) return;
    const from = items.findIndex((row) => row.id === dragId);
    const to = items.findIndex((row) => row.id === targetId);
    clearDrag();
    if (from !== -1 && to !== -1) {
      void reorder(from, to);
    }
  }

  const header = (
    <PageHeader
      breadcrumbs={[
        { label: teamName, href: "/dashboard" },
        { label: project.name, href: `/dashboard/projects/${project.id}` },
        { label: "Pages" },
      ]}
      title="Pages"
      description={`${used} of ${pageLimit ?? "unlimited"} pages used`}
      actions={
        atLimit ? (
          <Link href="/dashboard/plan" className={buttonVariants({ variant: "secondary", size: "md" })}>
            See plans
          </Link>
        ) : (
          <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
            <Plus size={18} strokeWidth={1.75} aria-hidden />
            Add page
          </Button>
        )
      }
    />
  );

  if (items.length === 0) {
    return (
      <AppPage width="default">
        {header}
        <AppEmptyState
          icon={<FileText size={48} strokeWidth={1.75} aria-hidden className="text-text-muted" />}
          title="No pages yet"
          description="Add your first page and it will show up here."
          action={
            atLimit ? undefined : (
              <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
                <Plus size={18} strokeWidth={1.75} aria-hidden />
                Add page
              </Button>
            )
          }
        />
        <AddPageDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          projectId={project.id}
          subdomain={project.subdomain}
          onCreated={(page) => setItems((prev) => [...prev, page])}
        />
      </AppPage>
    );
  }

  return (
    <AppPage width="default">
      {header}

      {atLimit ? (
        <div className="mb-4 flex flex-col gap-3 rounded-info border border-warning-border bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Lock size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-warning-text" />
            <p className="text-[15px] text-warning-text">
              Your {planName} plan includes {pageLimit} page{pageLimit === 1 ? "" : "s"}. Upgrade to add
              more.
            </p>
          </div>
          <Link
            href="/dashboard/plan"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0 self-start sm:self-auto")}
          >
            See plans
          </Link>
        </div>
      ) : null}

      <AppCard className="overflow-visible p-0">
        <ul>
          {items.map((page, index) => {
            const isDragging = dragId === page.id;
            const isTarget = dragId !== null && dragId !== page.id && overId === page.id;
            const helpId = `delete-help-${page.id}`;

            return (
              <li
                key={page.id}
                className={cn(
                  "relative border-t border-border transition first:border-t-0",
                  isDragging && "z-10 scale-[1.01] bg-surface shadow-raised",
                )}
                draggable={armedId === page.id}
                onDragStart={(event) => {
                  setDragId(page.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", page.id);
                }}
                onDragOver={(event) => {
                  if (!dragId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (overId !== page.id) setOverId(page.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(page.id);
                }}
                onDragEnd={clearDrag}
              >
                {isTarget ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-10 rounded-input border-2 border-dashed border-border-strong"
                  />
                ) : null}

                <div className="flex min-h-[72px] items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    aria-label={`Move ${page.title}`}
                    onMouseDown={() => setArmedId(page.id)}
                    onMouseUp={() => setArmedId(null)}
                    onBlur={() => setArmedId((current) => (current === page.id ? null : current))}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        void reorder(index, index - 1);
                      }
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        void reorder(index, index + 1);
                      }
                    }}
                    className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-input text-text-muted transition-colors hover:bg-surface-muted active:cursor-grabbing"
                  >
                    <GripVertical size={20} strokeWidth={1.75} aria-hidden />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{page.title}</span>
                      {page.is_homepage ? (
                        <Badge variant="primary" className="shrink-0 gap-1">
                          <House size={12} strokeWidth={1.75} aria-hidden />
                          Home
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-text-muted">{page.path}</p>
                    {page.updated_at ? (
                      <p className="mt-0.5 text-xs text-text-muted">
                        Edited {relativeTime(page.updated_at)}
                      </p>
                    ) : null}
                  </div>

                  <Badge variant="draft" className="hidden shrink-0 xs:inline-flex">
                    Draft
                  </Badge>

                  <Link
                    href={`/dashboard/projects/${project.id}/pages/${page.id}`}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
                  >
                    Edit
                  </Link>

                  <Menu
                    label={`Actions for ${page.title}`}
                    trigger={(triggerProps) => (
                      <button
                        type="button"
                        {...triggerProps}
                        aria-label={`More actions for ${page.title}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-surface-muted"
                      >
                        <MoreVertical size={20} strokeWidth={1.75} aria-hidden />
                      </button>
                    )}
                  >
                    <MenuItem onClick={() => setRenameId(page.id)}>Rename</MenuItem>
                    {page.is_homepage ? null : (
                      <MenuItem onClick={() => void setHomepage(page)}>Set as homepage</MenuItem>
                    )}
                    <MenuItem disabled={index === 0} onClick={() => void reorder(index, index - 1)}>
                      Move up
                    </MenuItem>
                    <MenuItem
                      disabled={index === items.length - 1}
                      onClick={() => void reorder(index, index + 1)}
                    >
                      Move down
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      destructive
                      disabled={page.is_homepage}
                      aria-describedby={page.is_homepage ? helpId : undefined}
                      onClick={() => setDeleteId(page.id)}
                    >
                      Delete
                    </MenuItem>
                    {page.is_homepage ? (
                      <p id={helpId} className="px-3 pb-1.5 pt-1 text-xs text-text-muted">
                        Make another page your homepage first.
                      </p>
                    ) : null}
                  </Menu>
                </div>
              </li>
            );
          })}
        </ul>
      </AppCard>

      <AddPageDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        projectId={project.id}
        subdomain={project.subdomain}
        onCreated={(page) => setItems((prev) => [...prev, page])}
      />

      <RenamePageDialog
        open={renamePage !== null}
        page={renamePage}
        subdomain={project.subdomain}
        onClose={() => setRenameId(null)}
        onRename={rename}
      />

      <DeletePageDialog
        open={deletePageRow !== null}
        page={deletePageRow}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deletePageRow) void removePage(deletePageRow);
        }}
      />
    </AppPage>
  );
}
