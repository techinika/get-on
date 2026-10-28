export type AdminSiteRow = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  reviewState: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  reviewRequestedAt: string | null;
  teamId: string;
  teamName: string;
  ownerEmail: string;
  lastPublishedAt: string | null;
  reportCount: number;
  newReportCount: number;
};

export function adminSiteStatus(site: {
  status: string;
  reviewState: string;
  suspendedAt: string | null;
}): "Live" | "Not published" | "Under review" | "Suspended" {
  if (site.suspendedAt) return "Suspended";
  if (site.reviewState === "pending") return "Under review";
  return site.status === "published" ? "Live" : "Not published";
}
