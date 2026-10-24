import { CloudflareHostnameProvider, type CloudflareOptions } from "./cloudflare";
import type { DomainsConfig } from "./config";
import { FakeHostnameProvider } from "./fake";
import type { HostnameProvider } from "./provider";

export type CreateProviderOptions = {
  fake?: ConstructorParameters<typeof FakeHostnameProvider>[0];
  cloudflare?: CloudflareOptions;
};

export function createHostnameProvider(
  config: DomainsConfig,
  options: CreateProviderOptions = {},
): HostnameProvider {
  if (config.provider === "cloudflare") {
    return new CloudflareHostnameProvider(config, options.cloudflare);
  }
  return new FakeHostnameProvider({
    includedHostnames: config.includedHostnames,
    ...options.fake,
  });
}
