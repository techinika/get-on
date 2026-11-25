"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, QrCode, X } from "lucide-react";

function safeHttpUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function QrDialog({
  open,
  url,
  onClose,
  description = "Scan this QR code to open the website link.",
}: {
  open: boolean;
  url: string;
  onClose: () => void;
  description?: string;
}) {
  const [caption, setCaption] = useState("Scan to visit");
  const [qrState, setQrState] = useState<{
    url: string;
    src: string | null;
    error: string | null;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const validUrl = safeHttpUrl(url);
  const dataUrl = validUrl && qrState?.url === validUrl ? qrState.src : null;
  const error = !validUrl
    ? "This address cannot be turned into a QR code."
    : qrState?.url === validUrl
      ? qrState.error
      : null;
  const copied = Boolean(validUrl && copiedUrl === validUrl);

  useEffect(() => {
    if (!open || !validUrl) return;
    let cancelled = false;

    QRCode.toDataURL(validUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
      color: { dark: "#111827", light: "#FFFFFF" },
    })
      .then((generated) => {
        if (!cancelled) {
          setQrState({ url: validUrl, src: generated, error: null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrState({
            url: validUrl,
            src: null,
            error: "Could not generate QR code.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, validUrl]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleCopy() {
    if (!validUrl) return;
    try {
      await navigator.clipboard.writeText(validUrl);
      setCopiedUrl(validUrl);
      window.setTimeout(() => {
        setCopiedUrl((current) => (current === validUrl ? null : current));
      }, 1800);
    } catch {
      // Clipboard blocked
    }
  }

  function handleDownloadPng() {
    if (!dataUrl || !validUrl) return;
    const trimmedCaption = caption.trim();
    const img = new window.Image();
    img.onload = () => {
      const size = 640;
      const padding = 48;
      const captionHeight = trimmedCaption ? 64 : 0;
      const canvas = document.createElement("canvas");
      canvas.width = size + padding * 2;
      canvas.height = size + padding * 2 + captionHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, padding, padding, size, size);

      if (trimmedCaption) {
        ctx.fillStyle = "#111827";
        ctx.font = "600 28px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          trimmedCaption,
          canvas.width / 2,
          padding + size + captionHeight / 2,
          size,
        );
      }

      const href = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const host = new URL(validUrl).hostname.replace(/[^a-z0-9.-]/gi, "-");
      link.href = href;
      link.download = `${host || "website"}-qr.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    };
    img.src = dataUrl;
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[560px] rounded-dialog bg-surface p-6 shadow-raised">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="qr-dialog-title" className="text-h3 text-text">
              QR code
            </h2>
            <p className="mt-1 text-sm text-text-muted">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-row-hover"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center rounded-info border border-border bg-white p-3">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl}
                alt={validUrl ? `QR code for ${validUrl}` : "QR code"}
                className="h-44 w-44 object-contain"
              />
            ) : (
              <div className="flex h-44 w-44 items-center justify-center text-text-muted">
                <QrCode size={64} strokeWidth={1.5} aria-hidden />
              </div>
            )}
            {caption.trim() ? (
              <p className="mt-2 max-w-[176px] truncate text-center text-xs font-semibold text-[#111827]">
                {caption.trim()}
              </p>
            ) : null}
          </div>

          <div className="w-full flex-1 space-y-4">
            <div>
              <label
                htmlFor="qr-caption-input"
                className="block text-sm font-semibold text-text"
              >
                Caption
              </label>
              <input
                id="qr-caption-input"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={40}
                placeholder="Scan to visit"
                className="mt-1.5 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 py-2.5 text-sm text-text"
              />
            </div>

            {validUrl ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Destination
                </p>
                <div className="mt-1 flex items-center gap-2 rounded-input border border-border bg-surface-muted px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-text">
                    {validUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label="Copy link"
                    className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-surface"
                  >
                    {copied ? (
                      <>
                        <Check size={14} aria-hidden /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={14} aria-hidden /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-danger-text" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-surface-muted px-4 py-2 text-sm font-medium text-text hover:bg-row-hover"
          >
            Close
          </button>
          <button
            type="button"
            disabled={!dataUrl}
            onClick={handleDownloadPng}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} aria-hidden />
            Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}
