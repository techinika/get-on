export const THEME_COOKIE = "get-on-theme";

export type ThemeChoice = "light" | "dark" | "system";

/**
 * Inline script run before paint so the correct theme is applied without a
 * flash of the wrong colours. Reads the `get-on-theme` cookie.
 */
export const themeInitScript = `(function(){try{var c=document.cookie.match(/(?:^|;\\s*)get-on-theme=([^;]+)/);var t=c?c[1]:"system";if(t!=="light"&&t!=="dark"&&t!=="system")t="system";var root=document.documentElement;if(t==="light"||t==="dark"){root.setAttribute("data-theme",t);}else{root.removeAttribute("data-theme");}var dark=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);root.classList.toggle("dark",dark);}catch(e){}})();`;

export function themeChoiceFromCookie(cookieHeader: string | null): ThemeChoice {
  const match = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]+)`));
  const value = match?.[1];
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveDark(choice: ThemeChoice, prefersDark: boolean): boolean {
  return choice === "dark" || (choice === "system" && prefersDark);
}
