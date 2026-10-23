export type PluginStatus = 'available' | 'planned';

export type PluginNavItem = {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: 'unread';
};

export type PluginManifest = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  status: PluginStatus;
  freeOk: boolean;
  blocks: string[];
  templates: string[];
  nav: PluginNavItem[];
  settingsRoute?: string;
  checklist: string[];
};

export type PluginInstallState = 'active' | 'disabled' | 'locked';
