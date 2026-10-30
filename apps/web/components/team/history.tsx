"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { InfoBox } from "@/components/app/info-box";

type TeamHistoryCardProps = {
  teamId: string;
};

type ActivityRow = {
  project_id: string | null;
  action: string;
  created_at: string;
  website_name: string | null;
  website_views: number | null;
};

type ProjectRow = {
  id: string;
  name: string;
  subdomain: string | null;
  status: string;
  created_at: string;
};

type WebsiteSummary = {
  id: string;
  name: string;
  subdomain: string | null;
  status: string;
  createdAt: Date;
  publishedFirstAt: Date | null;
  deletedAt: Date | null;
  restoredAt: Date | null;
  views: number;
};

type TimelineEvent = {
  date: Date;
  title: string;
  type: "created" | "deleted" | "restored";
  websiteName: string;
};

export function TeamHistoryCard({ teamId }: TeamHistoryCardProps) {
  const [websites, setWebsites] = useState<WebsiteSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!teamId) return;

    const supabase = createClient();

    // Fetch team websites and their activity
    const fetchWebsites = async () => {
      const [{ data: team }, { data: activity }] = await Promise.all([
        supabase.from("teams").select("id, name").eq("id", teamId).single(),
        supabase
          .from("team_activity")
          .select("project_id, action, created_at, website_name, website_views")
          .eq("team_id", teamId)
          .order("created_at", { ascending: true }),
      ]);

      if (!team) return;

      // Group activity by project
      const projectActivity: Record<string, ActivityRow[]> = {};
      ((activity ?? []) as ActivityRow[]).forEach((row) => {
        const pid = row.project_id;
        if (!pid) return;
        if (!projectActivity[pid]) projectActivity[pid] = [];
        projectActivity[pid].push(row);
      });

      // Fetch all projects in the team
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, subdomain, status, created_at")
        .eq("team_id", teamId);

      if (!projects) {
        setLoaded(true);
        return;
      }

      const websiteSummaries = (projects as ProjectRow[]).map((proj) => {
        const activity = projectActivity[proj.id] ?? [];
        const created = activity.filter((a) => a.action === "create");
        const deleted = activity.filter((a) => a.action === "delete");
        const restored = activity.filter((a) => a.action === "restore");

        const firstCreated = created.length > 0
          ? new Date(created[0].created_at)
          : null;
        const lastDeleted = deleted.length > 0
          ? new Date(Math.max(...deleted.map((d) => new Date(d.created_at).getTime())))
          : null;
        const lastRestored = restored.length > 0
          ? new Date(Math.max(...restored.map((r) => new Date(r.created_at).getTime())))
          : null;

        const totalViews = activity.reduce(
          (sum, a) => sum + (a.website_views ?? 0),
          0
        );

        return {
          id: proj.id,
          name: proj.name,
          subdomain: proj.subdomain,
          status: proj.status,
          createdAt: firstCreated ?? new Date(proj.created_at),
          publishedFirstAt: null,
          deletedAt: lastDeleted,
          restoredAt: lastRestored,
          views: totalViews,
        };
      });

      setWebsites(websiteSummaries);
      setLoaded(true);
    };

    fetchWebsites();
  }, [teamId]);

  // Chart: stepped area for active websites over time
  // We'll replay created/deleted/restored events to compute active count over time
  const { activeOverTime, timelineEvents } = useMemo(() => {
    // Replay events to compute active websites over time
    const allEvents: Array<{ date: Date; type: "create" | "delete" | "restore"; websiteId: string; websiteName: string }> = [];

    websites.forEach((w) => {
      // Create event
      allEvents.push({
        date: w.createdAt,
        type: "create",
        websiteId: w.id,
        websiteName: w.name,
      });

      // Delete event (if deleted)
      if (w.deletedAt) {
        allEvents.push({
          date: w.deletedAt,
          type: "delete",
          websiteId: w.id,
          websiteName: w.name,
        });
      }

      // Restore event (if restored)
      if (w.restoredAt) {
        allEvents.push({
          date: w.restoredAt,
          type: "restore",
          websiteId: w.id,
          websiteName: w.name,
        });
      }
    });

    // Sort by date
    allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Compute active count at each event point
    let activeCount = 0;
    const points: Array<{ date: Date; count: number; type: "created" | "deleted" | "restored" }> = [];
    const eventRecords: TimelineEvent[] = [];

    allEvents.forEach((event) => {
      if (event.type === "create") {
        activeCount++;
        points.push({ date: event.date, count: activeCount, type: "created" });
        eventRecords.push({
          date: event.date,
          title: `${event.websiteName} was created`,
          type: "created",
          websiteName: event.websiteName,
        });
      } else if (event.type === "delete") {
        activeCount--;
        points.push({ date: event.date, count: activeCount, type: "deleted" });
        eventRecords.push({
          date: event.date,
          title: `${event.websiteName} was deleted`,
          type: "deleted",
          websiteName: event.websiteName,
        });
      } else if (event.type === "restore") {
        activeCount++;
        points.push({ date: event.date, count: activeCount, type: "restored" });
        eventRecords.push({
          date: event.date,
          title: `${event.websiteName} was restored`,
          type: "restored",
          websiteName: event.websiteName,
        });
      }
    });

    return { activeOverTime: points, timelineEvents: eventRecords };
  }, [websites]);

  if (!loaded) {
    return <p className="text-[12px] text-text-muted">Loading...</p>;
  }

  if (websites.length === 0) {
    return (
      <InfoBox info>
        <div className="flex items-center gap-3">
          <span className="iconify text-[20px]" data-icon="layout-template" aria-hidden />
          <span>Your websites will show up here.</span>
        </div>
      </InfoBox>
    );
  }

  // Render the chart
  const renderChart = () => {
    if (activeOverTime.length === 0) {
      return null;
    }

    const width = Math.max(400, websites.length * 40);
    const height = 140;

    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // X scale: from first creation to today
    const allDates = activeOverTime.map((d) => d.date);
    const minDate = allDates[0];
    const maxDate = allDates[allDates.length - 1];
    const today = new Date();
    const xDomain = [minDate, Math.max(maxDate, today)];

    // Y scale: integers for active count
    const maxCount = Math.max(...activeOverTime.map((d) => d.count), 1);
    const yDomain = [0, maxCount];

    // Generate SVG path for stepped area
    const generateSteppedArea = (): string => {
      const steps: string[] = [];

      activeOverTime.forEach((point, i) => {
        const x =
          margin.left +
          ((point.date.getTime() - xDomain[0].getTime()) / (xDomain[1].getTime() - xDomain[0].getTime())) *
            chartWidth;

        const y = margin.top + ((maxCount - point.count) / (yDomain[1] - yDomain[0])) * chartHeight;

        if (i === 0) {
          steps.push(`M ${x} ${y}`);
        } else {
          // Horizontal step down then vertical step
          const prev = activeOverTime[i - 1];
          const prevY =
            margin.top + ((maxCount - prev.count) / (yDomain[1] - yDomain[0])) * chartHeight;
          steps.push(`L ${x} ${prevY}`);
          steps.push(`L ${x} ${y}`);
        }
      });

      // Close the path
      const last = activeOverTime[activeOverTime.length - 1];
      const lastX =
        margin.left +
        ((last.date.getTime() - xDomain[0].getTime()) / (xDomain[1].getTime() - xDomain[0].getTime())) *
          chartWidth;
      const lastY = margin.top;
      steps.push(`L ${lastX} ${lastY}`);
      steps.push(`Z`);

      return steps.join(" ");
    };

    const areaPath = generateSteppedArea();

    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 ${width} ${height}"
        aria-label="Active websites over time"
        role="img"
      >
        <path d={areaPath} fill="var(--primary) at 12%" />
        <path
          d={areaPath}
          stroke="var(--primary)"
          stroke-width="2"
          fill="none"
        />
        {activeOverTime.map((point, i) => {
          const x =
            margin.left +
            ((point.date.getTime() - xDomain[0].getTime()) / (xDomain[1].getTime() - xDomain[0].getTime())) *
              chartWidth;

          const y =
            margin.top + ((maxCount - point.count) / (yDomain[1] - yDomain[0])) * chartHeight;

          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="8"
              fill={point.count > 0 ? "var(--primary)" : "var(--surface-muted)"}
              stroke={point.type === "created" ? "var(--primary)" : point.type === "deleted" ? "var(--danger)" : "var(--success)"}
            />
          );
        })}
        {timelineEvents.length > 0 && (
          <g>
            {timelineEvents
              .slice(0, 5) // Show up to 5 events
              .map((event, i) => {
                const x =
                  margin.left +
                  ((event.date.getTime() - xDomain[0].getTime()) / (xDomain[1].getTime() - xDomain[0].getTime())) *
                    chartWidth;

                const y =
                  margin.top + ((maxCount - 1) / (yDomain[1] - yDomain[0])) * chartHeight - 16;

                return (
                  <g key={i} transform={`translate(${x}, ${y})`}>
                    <circle cx="0" cy="0" r="4" fill={event.type === "created" ? "var(--primary)" : event.type === "deleted" ? "var(--danger)" : "var(--success)"} />
                    <text
                      x="12"
                      y="4"
                      font-size="12"
                      fill="var(--text)"
                      dominant-baseline="middle"
                    >
                      {event.title}
                    </text>
                  </g>
                );
              })}
          </g>
        )}
      </svg>
    );
  };

  return (
    <InfoBox info padding={20}>
      <div>
        <h3 className="text-[18px] font-semibold text-text">Your websites over time</h3>
        <p className="text-[14px] text-text-muted mt-1">
          Every website you created, including ones you deleted.
        </p>
      </div>

      {websites.length > 0 ? (
        <ChartContainer>
          {renderChart()}
          <Timeline
            events={timelineEvents}
            showAll={websites.length > 5}
          />
        </ChartContainer>
      ) : (
        <InfoBox info>
          <div className="text-center py-8">
            <span className="iconify text-[32px]" data-icon="layout-template" aria-hidden />
            <p className="text-[14px] text-text-muted mt-2">Your websites will show up here.</p>
          </div>
        </InfoBox>
      )}
    </InfoBox>
  );
}

/** Chart container with fixed height */
const ChartContainer = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <div className="mt-4" style={{ height: 140 }}>{children}</div>
);

/** Timeline component */
type TimelineProps = {
  events: Array<{
    date: Date;
    title: string;
    type: "created" | "deleted" | "restored";
    websiteName: string;
  }>;
  showAll: boolean;
};

function Timeline({ events, showAll }: TimelineProps) {
  const displayedEvents = showAll ? events : events.slice(0, 5);

  return (
    <div className="mt-8 max-h-[200px] overflow-y-auto">
      {displayedEvents.map((event, i) => (
        <div
          key={i}
          className="min-h-[56px] px-3 py-2 border-b border-border flex items-start gap-3"
        >
          <span className="w-8 h-8 rounded-full flex items-center justify-center">
            {event.type === "created"
              ? <span className="iconify text-[16px]" data-icon="plus-circle" aria-hidden />
              : event.type === "deleted"
              ? <span className="iconify text-[16px]" data-icon="trash" aria-hidden />
              : <span className="iconify text-[16px]" data-icon="rotate-ccw" aria-hidden />}
          </span>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-text">{event.websiteName} was {event.type}</p>
            <p className="text-[13px] text-text-muted">{event.date.toLocaleDateString()}</p>
          </div>
          {event.type === "deleted" && (
            <Badge variant="danger" className="ml-2 text-[11px]">
              Deleted
            </Badge>
          )}
        </div>
      ))}
      {showAll && events.length > 5 && (
        <div className="pt-2 text-center text-[12px] text-text-muted">
          <span>Show all</span>
        </div>
      )}
    </div>
  );
}