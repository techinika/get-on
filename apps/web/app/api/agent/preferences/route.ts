import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgentActor } from "@/lib/agent/auth";
import {
  ASSISTANT_OPEN_COOKIE,
  ASSISTANT_TAB_COOKIE,
  ASSISTANT_WIDTH_COOKIE,
  asAssistantTab,
  clampAssistantWidth,
} from "@/lib/agent/constants";

const bodySchema = z.object({
  open: z.boolean().optional(),
  width: z.number().optional(),
  tab: z.enum(["assistant", "help"]).optional(),
});

export async function PATCH(request: Request) {
  const actor = await getAgentActor();
  if (!actor) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That preference is not valid." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.open !== undefined) patch.assistant_open = parsed.data.open;
  if (parsed.data.width !== undefined) {
    patch.assistant_width = clampAssistantWidth(parsed.data.width);
  }
  if (parsed.data.tab !== undefined) {
    patch.assistant_tab = asAssistantTab(parsed.data.tab);
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("user_preferences").upsert(
      {
        user_id: actor.userId,
        ...patch,
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
  } catch (error) {
    console.error("[agent] could not save preferences", error);
    return NextResponse.json(
      { error: "We could not save that preference." },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  const maxAge = 60 * 60 * 24 * 365;
  if (parsed.data.open !== undefined) {
    response.cookies.set(ASSISTANT_OPEN_COOKIE, parsed.data.open ? "1" : "0", {
      path: "/",
      maxAge,
      sameSite: "lax",
    });
  }
  if (parsed.data.tab !== undefined) {
    response.cookies.set(ASSISTANT_TAB_COOKIE, parsed.data.tab, {
      path: "/",
      maxAge,
      sameSite: "lax",
    });
  }
  if (parsed.data.width !== undefined) {
    response.cookies.set(
      ASSISTANT_WIDTH_COOKIE,
      String(clampAssistantWidth(parsed.data.width)),
      { path: "/", maxAge, sameSite: "lax" },
    );
  }
  return response;
}
