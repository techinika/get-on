"use client";

import { useState } from "react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function AddressCard({ url, published }: { url: string; published: boolean }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function onCopy() {
    try {
      if (!url) return;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed");
    }
  }

  async function onShare() {
    if (!url) return;
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({ url });
      } else {
        await onCopy();
      }
    } catch {
      // The person closed the share sheet; nothing went wrong.
    } finally {
      setSharing(false);
    }
  }

  return (
    <AppCard className="max-w-[760px] p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-text">Your web address</p>
          <p className="mt-1 break-all text-[14px] text-text-muted">{url || "We could not find your address."}</p>
          <p className="mt-2 text-sm text-text-muted">
            {published
              ? "This address is live."
              : "This is your address. It shows your website after you publish."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onCopy} disabled={!url}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button type="button" variant="secondary" onClick={onShare} disabled={!url} loading={sharing} loadingLabel="Sharing...">
            Share
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!url || !published}
            onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
          >
            Open
          </Button>
        </div>
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-sm text-text-muted">
          QR codes are coming soon. For now, copy or share the link above.
        </p>
      </div>
    </AppCard>
  );
}
