export type PluginManifest = {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "available" | "planned";
  freeOk: boolean;
  nav: Array<{ label: string; route: string }>;
  settingsRoute: string;
};

export const PLUGIN_MANIFESTS: PluginManifest[] = [
  {
    id: "contact",
    name: "Contact forms",
    description: "Receive enquiries from visitors on your website with spam protection and email alerts.",
    icon: "mail",
    status: "available",
    freeOk: true,
    nav: [{ label: "Messages", route: "/messages" }],
    settingsRoute: "/plugins/contact",
  },
];
