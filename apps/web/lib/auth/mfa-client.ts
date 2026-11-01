export async function completeMfaSignIn(next: string): Promise<{ ok: boolean; next?: string }> {
  try {
    const response = await fetch("/api/auth/mfa/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next }),
    });
    const data = (await response.json()) as { ok?: boolean; next?: string };
    return { ok: response.ok && data.ok === true, next: data.next };
  } catch {
    return { ok: false };
  }
}
