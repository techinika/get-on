"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function ConnectDomainButton({
  websites,
}: {
  websites: { id: string; name: string; address: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>Connect a domain</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Which website?" width="form">
        <p className="text-[15px] text-text-muted">Choose the website this domain should open.</p>
        <div className="mt-4 grid gap-2">
          {websites.map((website) => (
            <Link
              key={website.id}
              href={`/dashboard/projects/${website.id}/settings/address/connect`}
              className="flex min-h-14 items-center justify-between gap-3 rounded-card border border-border px-4 py-3 hover:bg-surface-muted"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-text">{website.name}</span>
                <span className="block truncate text-sm text-text-muted">{website.address}</span>
              </span>
            </Link>
          ))}
        </div>
      </Dialog>
    </>
  );
}
