export {};

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: ((...args: unknown[]) => void) | undefined;
    __BASE_URL__?: string;
  }
}
