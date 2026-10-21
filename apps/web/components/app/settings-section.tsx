import * as React from "react";
import { cn } from "@/lib/utils";

export type SettingsSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * One row of a settings form: label and description on the left, controls on
 * the right (4/8 column split at 768 and above, stacked below).
 */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 border-b border-border py-6 last:border-b-0 md:grid-cols-12 md:gap-6",
        className,
      )}
    >
      <div className="md:col-span-4">
        <h3 className="text-card-title text-text">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-text-muted">{description}</p>
        ) : null}
      </div>
      <div className="md:col-span-8">{children}</div>
    </div>
  );
}
