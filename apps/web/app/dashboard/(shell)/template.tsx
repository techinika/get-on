import type { ReactNode } from "react";

/**
 * Fades page content in over 120 ms. The shell itself never animates
 * (spec §7.8).
 */
export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
