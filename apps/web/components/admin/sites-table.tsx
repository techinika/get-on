"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminSiteStatus, type AdminSiteRow } from "@/lib/admin-data";
import { relativeTime } from "@/lib/relative-time";

export type SiteTableRow = AdminSiteRow & { address: string };

type Sort = "published" | "reports";

const STATUS_VARIANT = {
  Live: "live",
  "Not published": "neutral",
  "Under review": "info",
  Suspended: "danger",
} as const;

export function SitesTable({ rows }: { rows: SiteTableRow[] }) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<Sort>("published");
  const [ascending, setAscending] = React.useState(false);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const match = needle
      ? rows.filter(
          (row) =>
            row.subdomain.toLowerCase().includes(needle) ||
            row.ownerEmail.toLowerCase().includes(needle) ||
            row.name.toLowerCase().includes(needle),
        )
      : rows;
    const sorted = [...match].sort((a, b) => {
      if (sort === "reports") return a.reportCount - b.reportCount;
      return (a.lastPublishedAt ?? "").localeCompare(b.lastPublishedAt ?? "");
    });
    return ascending ? sorted : sorted.reverse();
  }, [rows, query, sort, ascending]);

  function choose(next: Sort) {
    if (sort === next) {
      setAscending((value) => !value);
      return;
    }
    setSort(next);
    setAscending(false);
  }

  return (
    <>
      <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-end">
        <div className="w-full min-[640px]:max-w-[360px]">
          <label htmlFor="site-search" className="text-sm font-semibold text-text">
            Search
          </label>
          <div className="mt-1.5">
            <Input
              id="site-search"
              type="search"
              placeholder="Search by address or owner email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => choose("published")}
            aria-pressed={sort === "published"}
          >
            Last published
            {sort === "published" ? (
              ascending ? <ArrowUp size={14} aria-hidden /> : <ArrowDown size={14} aria-hidden />
            ) : null}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => choose("reports")}
            aria-pressed={sort === "reports"}
          >
            Reports
            {sort === "reports" ? (
              ascending ? <ArrowUp size={14} aria-hidden /> : <ArrowDown size={14} aria-hidden />
            ) : null}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="app-card mt-4 p-6">
          <p className="text-base text-text-muted">No websites match that search.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-sm text-text-muted">
                <th scope="col" className="px-4 py-3 font-semibold">Website</th>
                <th scope="col" className="px-4 py-3 font-semibold">Owner</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Last published</th>
                <th scope="col" className="px-4 py-3 font-semibold">Reports</th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => {
                const status = adminSiteStatus(row);
                return (
                  <tr key={row.id} className="text-sm">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/sites/${row.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {row.subdomain}.get-on.tech
                      </Link>
                      <p className="text-xs text-text-muted">{row.name}</p>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{row.ownerEmail}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {row.lastPublishedAt ? relativeTime(row.lastPublishedAt) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {row.reportCount}
                      {row.newReportCount > 0 ? (
                        <span className="ml-1 font-semibold text-danger-text">
                          ({row.newReportCount} new)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={row.address}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${row.subdomain}.get-on.tech`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted"
                      >
                        <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
