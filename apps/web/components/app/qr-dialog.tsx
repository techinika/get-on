"use client";

import { useState } from "react";
import { QrCode, Download, Check } from "lucide-react";

export function QrDialog({ open, url, onClose }: { open: boolean; url: string; onClose: () => void }) {
  const [caption, setCaption] = useState("Scan to visit");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-scrim flex items-center justify-center p-4">
      <div className="relative w-full max-w-[720px] rounded-dialog bg-surface p-6 shadow-raised">
        <h2 className="text-h3">QR code</h2>
        <p className="mt-2 text-text-muted">This code links to your tracked short link.</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="w-32 h-32 bg-white border border-border rounded-info flex items-center justify-center">
            <QrCode size={72} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-text">Caption</label>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={40}
              className="mt-1.5 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 py-2.5 text-sm text-text"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="rounded-full bg-surface-muted px-4 py-2 text-sm font-medium hover:bg-row-hover">Close</button>
          <button className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-dark">Download PNG</button>
        </div>
      </div>
    </div>
  );
}
