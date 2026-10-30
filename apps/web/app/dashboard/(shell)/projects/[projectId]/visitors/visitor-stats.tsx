"use client";

import { useEffect, useState } from "react";

type StatsResponse = {
  views: number;
  visitors: number;
};

export function VisitorStats({ projectId }: { projectId: string }) {
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/projects/${projectId}/stats?range=30d`)
      .then((response) => response.json())
      .then((data: StatsResponse) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setStats({ views: 0, visitors: 0 });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!stats) return null;

  return (
    <div className="mt-6">
      <h3 className="text-[15px] font-medium text-text">Last 30 days</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[24px] font-bold text-text"> {stats.visitors || 0} </p>
          <p className="text-[12px] text-text-muted">Visitors</p>
        </div>
        <div>
          <p className="text-[24px] font-bold text-text"> {stats.views || 0} </p>
          <p className="text-[12px] text-text-muted">Views</p>
        </div>
      </div>
    </div>
  );
}
