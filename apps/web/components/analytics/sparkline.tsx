"use client";

import { useEffect, useState } from "react";
import { getSparklines } from "@/lib/stats/reader";

type SparklineProps = {
  projectId: string;
  sparklineDays: number;
};

export function Sparkline({ projectId, sparklineDays }: SparklineProps) {
  const [points, setPoints] = useState<Array<number | null>>([]);
  const [trend, setTrend] = useState<"up" | "down" | "steady" | "new" | "collecting">(
    "collecting"
  );

  useEffect(() => {
    if (!projectId) return;

    const fetchSparklines = async () => {
      try {
        const result = await getSparklines(
          [projectId],
          sparklineDays
        ) as { projectId: string; points: number[]; trend: "up" | "down" | "steady" | "new" } | null;

        if (result && result.projectId === projectId) {
          setPoints(result.points);
          setTrend(result.trend);
        }
      } catch (e) {
        console.warn("Failed to fetch sparkline data", e);
      }
    };

    fetchSparklines();
  }, [projectId, sparklineDays]);

  if (!points || points.length === 0) {
    return (
      <p className="text-[12px] text-text-muted italic">
        Collecting data
      </p>
    );
  }

  // Generate sparkline SVG
  const generateSvg = (): string => {
    if (points.length < 2) return "";

    const width = points.length * 2 + 30;
    const height = 32;
    const margin = { top: 4, right: 20, bottom: 4, left: 20 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate y scale
    const values = points.filter((p) => p !== null && !isNaN(p));
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 1;
    const range = Math.max(max - min, 1);

    let d = "";
    points.forEach((point, i) => {
      if (point === null || isNaN(point)) return;
      const x = margin.left + (i / (points.length - 1)) * chartWidth;
      const y =
        margin.top +
        ((max - point) / range) * chartHeight;

      if (i === 0) d += `M ${x} ${y}`;
      else d += `L ${x} ${y}`;
    });

    if (d === "") return "";

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"
        aria-label="Visits for the last ${sparklineDays} days: ${points.filter(
          (p) => p !== null && !isNaN(p)
        ).length} visits, ${trend}"/>
        <path d="${d}" stroke="var(--primary)" stroke-width="2" fill="var(--primary) at 12%" />
        ${points
          .filter((p) => p !== null && !isNaN(p))
          .slice(-1)[0] !== undefined
          ? `<circle
            cx="${margin.left + ((points.length - 1) / (points.length - 1)) * chartWidth}"
            cy="${margin.top + ((max - points[points.length - 1]) / range) * chartHeight}"
            r="4" fill="var(--primary)" />
          ` : ""}
      </svg>`
  };

  return <div dangerouslySetInnerHTML={{ __html: generateSvg() }} />;
}

/**
 * TrendBadge - shows the trend direction for a website's sparkline.
 */
type TrendBadgeProps = {
  projectId: string;
};

export function TrendBadge({ projectId }: TrendBadgeProps) {
  const [trend, setTrend] = useState<"up" | "down" | "steady" | "new" | "collecting">(
    "collecting"
  );

  useEffect(() => {
    if (!projectId) return;

    const checkTrend = async () => {
      try {
        const result = await getSparklines(
          [projectId],
          30
        ) as { projectId: string; points: number[]; trend: "up" | "down" | "steady" | "new" } | null;

        if (result && result.projectId === projectId) {
          setTrend(result.trend);
        }
      } catch (e) {
        console.warn("Failed to fetch trend data", e);
      }
    };

    checkTrend();
  }, [projectId]);

  if (trend === "collecting") {
    return (
      <span className="text-[12px] text-neutral hover:underline">
        Collecting data
      </span>
    );
  }

  const trendMap: Record<string, { class: string; label: string; icon: string }> = {
    up: {
      class: "accent soft",
      label: "Up",
      icon: "arrow-up-right",
    },
    down: {
      class: "neutral",
      label: "Down",
      icon: "arrow-down-right",
    },
    steady: {
      class: "neutral",
      label: "Steady",
      icon: "minus",
    },
    new: {
      class: "accent soft",
      label: "New",
      icon: "star",
    },
  };

  const t = trendMap[trend] || trendMap.steady;
  const changePercent = Math.abs(
    ((points[points.length - 1] || 0) - (points[0] || 0)) /
      (points[0] || 1) *
    100
  );

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-8 py-1.5 text-[12px] ${t.class} ${t.label === "Up" ? "text-success" : "text-text"}`}>
      <span className="iconify text-[10px]" data-icon={t.icon} aria-hidden />
      <span>{t.label} {changePercent > 0 ? `+${Math.round(changePercent)}%` : `${Math.round(changePercent)}%`}</span>
    </span>
  );
}