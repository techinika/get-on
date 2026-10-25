import type {
  HostnameMode,
  ProviderHostname,
  ProviderHealth,
  ProviderPage,
  ProviderSetup,
  ProviderUsage,
} from "./types";

export type CreateHostnameInput = {
  hostname: string;
  mode: HostnameMode;
};

export type HostnameProvider = {
  readonly name: string;
  checkSetup(): Promise<ProviderSetup>;
  createHostname(input: CreateHostnameInput): Promise<ProviderHostname>;
  getHostname(id: string, mode?: HostnameMode): Promise<ProviderHostname | null>;
  retryValidation(id: string, mode?: HostnameMode): Promise<ProviderHostname>;
  deleteHostname(id: string): Promise<void>;
  listHostnames(page: number): Promise<ProviderPage>;
  usage(): Promise<ProviderUsage>;
  health(): ProviderHealth;
};
