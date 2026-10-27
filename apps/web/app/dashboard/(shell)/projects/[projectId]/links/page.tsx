"use client";

import { useEffect, useState } from "react";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { LinkDialog } from "@/components/app/link-dialog";
import { QrDialog } from "@/components/app/qr-dialog";

export default function LinksPage({ params }: { params: Promise<{ projectId: string }> }) {
  const [openCreate, setOpenCreate] = useState(false);
  const [openQr, setOpenQr] = useState(false);
  const [links, setLinks] = useState<{ id: string; code: string; label: string | null; target_path: string; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    params.then(({ projectId }) => {
      setProjectId(projectId);
      fetch(`/api/projects/${projectId}/links`)
        .then((r) => r.json())
        .then((data) => {
          const rows = (data.links ?? []) as typeof links;
          setLinks(rows);
        })
        .catch(() => setLinks([]))
        .finally(() => setLoading(false));
    });
  }, [params]);

  return (
    <AppPage width="wide">
      <PageHeader
        breadcrumbs={[]}
        title="Links and QR codes"
        description="Share your website and see which links people open."
        actions={<Button onClick={() => setOpenCreate(true)}>Create link</Button>}
      />
      <AppCard className="max-w-[1120px] p-6">
        <p className="text-[14px] text-text-muted">Standard links (QR, WhatsApp, email, etc.) are created automatically when you share. Custom tracked links count toward your plan.</p>
        {loading ? (
          <div className="mt-4 text-sm text-text-muted">Loading links...</div>
        ) : links.length === 0 ? (
          <div className="mt-4 rounded-info border border-border bg-surface-muted p-4 text-sm text-text-muted">No custom links yet. Create one above, or share your website with the Share button to start counting opens.</div>
        ) : (
          <table className="mt-4 w-full text-sm text-text">
            <thead className="border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
              <tr>
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Where it goes</th>
                <th className="py-2 text-left">Opens (last 7 days)</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-b border-border hover:bg-row-hover">
                  <td className="py-3">{link.label ?? link.code}</td>
                  <td className="py-3 font-mono text-xs text-text-muted">{link.target_path}</td>
                  <td className="py-3">—</td>
                  <td className="py-3">{link.active ? "Active" : "Paused"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AppCard>
      <LinkDialog open={openCreate} onClose={() => setOpenCreate(false)} />
      <QrDialog open={openQr} url={links.length > 0 ? (`https://test.localhost/_l/${links[0].code}`) : "https://example.com"} onClose={() => setOpenQr(false)} />
    </AppPage>
  );
}
