"use client";

import { useState } from "react";
import Link from "next/link";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export default function LinksPage({ params }: { params: Promise<{ projectId: string }> }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-[20px] font-semibold text-text">Links and QR codes</h1>
        <Button onClick={() => setOpen(true)}>Create link</Button>
      </div>
      <AppCard className="max-w-[760px] p-6">
        <p className="text-[14px] text-text-muted">Tracked links and QR codes appear here once created. This list is a skeleton; the backend endpoints for links exist and work.</p>
        <div className="mt-4 text-xs text-text-muted">Page and detail UI are planned. Create tracked links via the Share menu or API if needed.</div>
      </AppCard>
    </div>
  );
}
