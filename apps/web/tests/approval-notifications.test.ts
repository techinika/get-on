import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  request: null as Record<string, unknown> | null,
  policy: { approve_permission: "billing.refund.approve" } as Record<string, unknown> | null,
  staff: [] as Array<{ user_id: string; role: string }>,
  users: new Map<string, { email: string; user_metadata: Record<string, unknown> }>(),
  enqueued: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

vi.mock("@/lib/supabase/admin", () => {
  function query(table: string) {
    const value =
      table === "approval_requests"
        ? state.request
        : table === "approval_policies"
          ? state.policy
          : state.staff;
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: value }),
      then: (resolve: (value: { data: unknown }) => unknown) =>
        Promise.resolve({ data: value }).then(resolve),
    };
    return chain;
  }

  return {
    createAdminClient: () => ({
      from: query,
      auth: {
        admin: {
          getUserById: async (id: string) => ({ data: { user: state.users.get(id) ?? null } }),
        },
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        state.enqueued.push({ name, args });
        return { error: null };
      },
    }),
  };
});

import {
  queueApprovalOutcome,
  queueApprovalRequested,
} from "@/lib/email/approval-notifications";

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "refund",
    target_type: "payment",
    target_id: "22222222-2222-4222-8222-222222222222",
    requested_by: "user-requester",
    requested_at: "2026-10-01T10:00:00.000Z",
    reason: "The customer was charged twice for the same invoice.",
    payload: { amount_usd: 25, team_name: "Rose Bakery" },
    status: "pending",
    requires_second: true,
    single_operator: false,
    expires_at: "2026-10-04T10:00:00.000Z",
    state_hash: null,
    first_approved_by: null,
    first_approved_at: null,
    decided_by: null,
    decided_at: null,
    decision_reason: null,
    executed_at: null,
    execution_error: null,
    ...overrides,
  };
}

function payloadAt(index: number): Record<string, unknown> {
  return state.enqueued[index]?.args.p_payload as Record<string, unknown>;
}

beforeEach(() => {
  state.request = null;
  state.policy = { approve_permission: "billing.refund.approve" };
  state.staff = [];
  state.users = new Map([
    [
      "user-requester",
      { email: "requester@get-on.tech", user_metadata: { full_name: "Rita Requester" } },
    ],
    [
      "user-super",
      { email: "super@get-on.tech", user_metadata: { full_name: "Sam Super" } },
    ],
    [
      "user-second",
      { email: "second@get-on.tech", user_metadata: { full_name: "Sofia Second" } },
    ],
    [
      "user-cs",
      { email: "cs@get-on.tech", user_metadata: { full_name: "Casey Success" } },
    ],
  ]);
  state.enqueued = [];
});

describe("approval notifications", () => {
  it("queues a request for approvers but not the requester or customer success", async () => {
    state.request = request();
    state.staff = [
      { user_id: "user-super", role: "super_admin" },
      { user_id: "user-second", role: "super_admin" },
      { user_id: "user-requester", role: "super_admin" },
      { user_id: "user-cs", role: "customer_success" },
    ];

    await queueApprovalRequested(String(state.request.id));

    expect(state.enqueued).toHaveLength(2);
    expect(state.enqueued.map((row) => row.args.p_user_id)).toEqual([
      "user-super",
      "user-second",
    ]);
    expect(state.enqueued[0].args.p_kind).toBe("approval_requested");
    expect(state.enqueued[0].args.p_related_id).toBe(state.request.id);
    expect(payloadAt(0).subject).toBe("Approval needed: Refund a payment");
    expect(payloadAt(0).text).toContain("/admin/approvals/11111111-1111-4111-8111-111111111111");
    expect(payloadAt(0).text).toContain("Rose Bakery");
    expect(payloadAt(0).text).toContain("Rita Requester");
  });

  it("asks the remaining approvers for a second decision", async () => {
    state.request = request({
      first_approved_by: "user-super",
      first_approved_at: "2026-10-01T11:00:00.000Z",
    });
    state.staff = [
      { user_id: "user-super", role: "super_admin" },
      { user_id: "user-second", role: "super_admin" },
      { user_id: "user-requester", role: "super_admin" },
    ];

    await queueApprovalOutcome(String(state.request.id));

    expect(state.enqueued).toHaveLength(1);
    expect(state.enqueued[0].args.p_user_id).toBe("user-second");
    expect(state.enqueued[0].args.p_kind).toBe("approval_decided");
    expect(payloadAt(0).subject).toBe("Second approval needed: Refund a payment");
    expect(payloadAt(0).text).toContain("Sam Super");
  });

  it("tells the requester when the action finished", async () => {
    state.request = request({ status: "executed", executed_at: "2026-10-01T12:00:00.000Z" });

    await queueApprovalOutcome(String(state.request.id));

    expect(state.enqueued).toHaveLength(1);
    expect(state.enqueued[0].args.p_user_id).toBe("user-requester");
    expect(state.enqueued[0].args.p_kind).toBe("approval_decided");
    expect(state.enqueued[0].args.p_dedupe_key).toBe(
      "approval:11111111-1111-4111-8111-111111111111:executed:user-requester",
    );
    expect(payloadAt(0).subject).toBe("Approved and done: Refund a payment");
  });

  it("uses the expiry kind when the request ran out of time", async () => {
    state.request = request({ status: "expired" });

    await queueApprovalOutcome(String(state.request.id));

    expect(state.enqueued).toHaveLength(1);
    expect(state.enqueued[0].args.p_kind).toBe("approval_expired");
    expect(payloadAt(0).subject).toBe("Request expired: Refund a payment");
  });
});
