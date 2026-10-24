"use client";

import { usePathname } from "next/navigation";

export function SettingsPageHeader({ title, description, timing }: { title: string; description: string; timing: "right" | "publish" }) {
  return (
    <header className="mb-6">
      <div className="text-sm text-text-muted">
        <a className="text-primary hover:underline" href={`../settings`}>Settings</a>
        {" / "}
        <span>{title}</span>
      </div>
      <h1 className="mt-2 font-heading text-[22px] font-bold text-text">{title}</h1>
      <p className="mt-1 text-[15px] text-text-muted">{description}</p>
      <div className={`mt-3 inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold ${timing === "right" ? "bg-success-soft text-success" : "bg-surface-muted text-text-muted"}`}>
        {timing === "right" ? "Applies right away" : "Applies when you publish"}
      </div>
    </header>
  );
}
