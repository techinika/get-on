import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  const { projectId } = await params;

  const admin = createAdminClient();

  try {
    // Get the stats state to understand rollup status
    const { data: state } = await admin
      .from("site_stats_state")
      .select("cursor, last_success_at, last_window_start, last_window_end, lag_seconds")
      .single();

    // Try to get daily stats for the project
    const { data: dailyStats, error: dailyError } = await admin
      .from("site_stats_daily")
      .select("views, visitors, day")
      .eq("project_id", projectId)
      .order("day", { ascending: false })
      .limit(30);

    if (dailyError && dailyError.code !== "PGRST116") {
      // Table might not exist yet, return empty
      return NextResponse.json({ views: 0, visitors: 0, daily: [], state });
    }

    let daily = [];
    if (dailyStats && Array.isArray(dailyStats)) {
      daily = dailyStats.map((row: any) => ({
        day: row.day,
        views: row.views || 0,
        visitors: row.visitors || 0,
      }));
    }

    // Get platform state info
    let status = " collecting";
    if (state) {
      const now = new Date();
      const lastSuccess = new Date(state.last_success_at);
      const diffHours = (now.getTime() - lastSuccess.getTime()) / (1000 * 60 * 60);
      if (diffHours < 24) {
        status = ` last updated ${Math.round(diffHours)}h ago`;
      } else {
        status = ` last updated ${Math.round(diffHours / 24)}d ago`;
      }
    }

    return NextResponse.json({ views: daily.reduce((sum: number, r: any) => sum + r.views, 0), visitors: daily.reduce((sum: number, r: any) => sum + r.visitors, 0), daily, status });
  } catch {
    return NextResponse.json({ views: 0, visitors: 0, daily: [], status: "error" }, { status: 500 });
  }
}