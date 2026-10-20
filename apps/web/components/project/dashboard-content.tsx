"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, LayoutTemplate, MoreVertical, Plus, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { gradientFor } from "@/lib/gradient";
import { cn } from "@/lib/utils";

export type DashboardProject = {
  id: string;
  name: string;
  subdomain: string;
  status: "draft" | "published";
};

export type DashboardContentProps = {
  planName: string;
  websiteCount: number;
  maxWebsites: number | null;
  memberCount: number;
  maxMembers: number | null;
  aiCredits: number;
  projects: DashboardProject[];
};

function usageLabel(count: number, max: number | null): string {
  return max === null ? `${count} of unlimited` : `${count} of ${max}`;
}

function usageRatio(count: number, max: number | null): number {
  if (max === null || max === 0) return 0;
  return Math.min(100, (count / max) * 100);
}

export function DashboardContent({
  planName,
  websiteCount,
  maxWebsites,
  memberCount,
  maxMembers,
  aiCredits,
  projects,
}: DashboardContentProps) {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-h1">Your websites</h1>
        <Link
          href="/dashboard/new"
          className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full sm:w-auto")}
        >
          <Plus size={20} strokeWidth={1.75} aria-hidden />
          Create website
        </Link>
      </div>

      {/* Usage card */}
      <Card className="mt-6 p-5">
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          <UsageCell
            label="Websites"
            value={usageLabel(websiteCount, maxWebsites)}
            ratio={usageRatio(websiteCount, maxWebsites)}
          />
          <UsageCell
            label="Team members"
            value={usageLabel(memberCount, maxMembers)}
            ratio={usageRatio(memberCount, maxMembers)}
            className="md:pl-6"
          />
          <UsageCell
            label="AI credits left"
            value={`${aiCredits} of ${aiCredits}`}
            ratio={0}
            className="md:pl-6"
          />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
          <p className="text-text-muted">You are on the {planName} plan.</p>
          <Link href="/#pricing" className="font-semibold text-primary hover:underline">
            See plans
          </Link>
        </div>
      </Card>

      {projects.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft">
              <LayoutTemplate size={56} strokeWidth={1.75} aria-hidden className="text-accent-text" />
            </span>
          }
          title="Let us get your business online"
          description="It takes about 5 minutes. We will ask a few simple questions and set everything up for you."
          action={
            <Link
              href="/dashboard/new"
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              Create your first website
            </Link>
          }
        />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function UsageCell({
  label,
  value,
  ratio,
  className,
}: {
  label: string;
  value: string;
  ratio: number;
  className?: string;
}) {
  return (
    <div className={cn("py-4 first:pt-0 last:pb-0 md:px-6 md:first:pl-0", className)}>
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {ratio > 0 ? (
        <Progress
          value={ratio}
          warning={ratio >= 80}
          label={`${label} usage`}
          className="mt-2"
        />
      ) : null}
    </div>
  );
}

function ProjectCard({ project }: { project: DashboardProject }) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  const href = `/dashboard/projects/${project.id}`;

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(friendlyError(body.error), "error");
        return;
      }
      toast(`${project.name} was deleted.`, "success");
      setDeleteOpen(false);
      router.refresh();
    } catch {
      toast(friendlyError("NETWORK_ERROR"), "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card className="overflow-hidden p-0 transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-raised">
        <div className="relative aspect-video">
          <div aria-hidden className="absolute inset-0" style={{ background: gradientFor(project.id) }} />
          <div className="absolute inset-4 overflow-hidden rounded-input bg-white/90">
            <div className="flex h-5 items-center gap-1 px-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8DFD0]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8DFD0]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8DFD0]" />
            </div>
            <div className="flex h-[calc(100%-20px)] items-center justify-center">
              <span className="font-heading text-[32px] font-bold text-[#1F1A17]">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="absolute right-3 top-3">
            {project.status === "published" ? (
              <Badge variant="live" dot>
                Live
              </Badge>
            ) : (
              <Badge variant="draft">Draft</Badge>
            )}
          </div>
        </div>
        <div className="p-4">
          <h2 className="truncate text-lg font-semibold">{project.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
            <Globe size={14} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="truncate">{project.subdomain}.get-on.tech</span>
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Link href={href} className={cn(buttonVariants({ variant: "primary", size: "md" }), "flex-1")}>
              Open
            </Link>
            <Menu
              label={`Actions for ${project.name}`}
              trigger={(props) => (
                <button
                  type="button"
                  {...props}
                  aria-label={`More actions for ${project.name}`}
                  className={cn(buttonVariants({ variant: "secondary", size: "md" }), "w-11 px-0")}
                >
                  <MoreVertical size={20} strokeWidth={1.75} aria-hidden />
                </button>
              )}
            >
              <MenuItem onClick={() => router.push(href)}>Open</MenuItem>
              <MenuItem destructive onClick={() => setDeleteOpen(true)}>
                Delete website
              </MenuItem>
            </Menu>
          </div>
        </div>
      </Card>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${project.name}?`}
        icon={
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft">
            <TriangleAlert size={24} strokeWidth={1.75} aria-hidden className="text-danger" />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={confirmText !== project.name}
              onClick={handleDelete}
            >
              Delete website
            </Button>
          </>
        }
      >
        <p className="text-base text-text-muted">
          Your website will be taken down. You can ask us to bring it back within 14 days.
        </p>
        <div className="mt-4">
          <Label htmlFor="delete-confirm">Type {project.name} to confirm</Label>
          <Input
            id="delete-confirm"
            className="mt-1.5"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
        </div>
      </Dialog>
    </>
  );
}
