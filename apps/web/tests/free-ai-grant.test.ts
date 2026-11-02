import { describe, expect, it } from "vitest";
import { ensureFreeGrant } from "@/lib/ai/settings";

type Profile = { id: string; free_ai_grant_at: string | null } | null;

function adminStub(input: {
  profile: Profile;
  claimed?: boolean;
  grantError?: { message: string } | null;
}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const profileUpdates: Array<Record<string, unknown>> = [];

  function profiles() {
    let updateValues: Record<string, unknown> | null = null;
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      update: (values: Record<string, unknown>) => {
        updateValues = values;
        profileUpdates.push(values);
        return chain;
      },
      maybeSingle: async () => {
        if (updateValues) {
          return { data: input.claimed === false ? null : { id: "user-1" }, error: null };
        }
        return { data: input.profile, error: null };
      },
      then: (resolve: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve),
    };
    return chain;
  }

  return {
    calls,
    profileUpdates,
    from(table: string) {
      if (table !== "profiles") throw new Error(`unexpected table ${table}`);
      return profiles();
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return { data: "bucket-1", error: input.grantError ?? null };
    },
  };
}

describe("free AI grant", () => {
  it("grants once with the service-role RPC contract", async () => {
    const admin = adminStub({ profile: null });

    await expect(
      ensureFreeGrant(admin as never, "team-1", "user-1", 25),
    ).resolves.toBe(true);

    expect(admin.calls).toEqual([
      {
        name: "grant_credits",
        args: {
          p_team: "team-1",
          p_kind: "free_grant",
          p_amount: 25,
          p_expires: null,
          p_source: "free:user-1",
          p_note: "Free AI credits to start",
        },
      },
    ]);
  });

  it("does nothing when the account already claimed the grant", async () => {
    const admin = adminStub({ profile: { id: "user-1", free_ai_grant_at: "2026-01-01T00:00:00Z" } });

    await expect(
      ensureFreeGrant(admin as never, "team-1", "user-1", 25),
    ).resolves.toBe(false);

    expect(admin.calls).toEqual([]);
    expect(admin.profileUpdates).toEqual([]);
  });

  it("releases the claim when granting fails", async () => {
    const admin = adminStub({
      profile: null,
      grantError: { message: "AI_FORBIDDEN" },
    });

    await expect(
      ensureFreeGrant(admin as never, "team-1", "user-1", 25),
    ).rejects.toEqual({ message: "AI_FORBIDDEN" });

    expect(admin.profileUpdates).toEqual([
      { free_ai_grant_at: expect.any(String) },
      { free_ai_grant_at: null },
    ]);
  });
});
