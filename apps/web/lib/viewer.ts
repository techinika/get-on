/** The signed-in person, as shown in menus and avatars. */
export type Viewer = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

/**
 * Two letter initials for an avatar. Falls back to the first letter of the
 * email, then to "U".
 */
export function initialsFrom(name: string | null | undefined, email: string | undefined): string {
  const source = (name ?? "").trim() || (email ?? "").trim();
  if (!source) return "U";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}
