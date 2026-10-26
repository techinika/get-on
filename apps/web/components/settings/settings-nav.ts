import {
  BarChart3,
  Building2,
  CornerUpRight,
  FileDown,
  Globe,
  History,
  Map,
  PenLine,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

export type SettingsNavItem = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    "aria-hidden"?: boolean;
    className?: string;
  }>;
  danger?: boolean;
};

export type SettingsNavGroup = {
  label: string;
  items: SettingsNavItem[];
};

export const SETTINGS_GROUPS: SettingsNavGroup[] = [
  {
    label: "Website",
    items: [
      { href: "business", label: "Business", description: "Name, tagline and contact details.", icon: Building2 },
      { href: "writing", label: "Writing style", description: "How AI sounds when it writes for you.", icon: PenLine },
      { href: "address", label: "Address", description: "Your web address and sharing.", icon: Globe },
      { href: "publishing", label: "Publishing", description: "Pause your website and edit messages.", icon: Rocket },
    ],
  },
  {
    label: "Search and visitors",
    items: [
      { href: "search", label: "Search appearance", description: "How you look in search results.", icon: Search },
      { href: "sitemap", label: "Sitemap and Google", description: "Help search engines find your pages.", icon: Map },
      { href: "redirects", label: "Moved pages", description: "Send old addresses to new pages.", icon: CornerUpRight },
      { href: "analytics", label: "Visitors and analytics", description: "Count visits and connect Google Analytics.", icon: BarChart3 },
    ],
  },
  {
    label: "Safety",
    items: [
      { href: "backups", label: "Backups", description: "Safe copies you can go back to.", icon: ShieldCheck },
      { href: "export-import", label: "Export and import", description: "Download or bring back a website.", icon: FileDown },
    ],
  },
  {
    label: "Ownership",
    items: [
      { href: "transfer", label: "Transfer", description: "Move this website somewhere else.", icon: Send },
      { href: "delete", label: "Delete website", description: "Take it offline and remove it later.", icon: Trash2, danger: true },
    ],
  },
  {
    label: "History",
    items: [
      { href: "activity", label: "Activity", description: "What has happened on this website.", icon: History },
      { href: "ai-history", label: "AI history", description: "What AI wrote and what it cost.", icon: Sparkles },
    ],
  },
];
