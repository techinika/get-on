import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type JobMode =
  | "verify"
  | "poll"
  | "health"
  | "plan"
  | "cleanup"
  | "migrate-pointers";

export const ALL_JOB_MODES: JobMode[] = [
  "verify",
  "poll",
  "health",
  "plan",
  "cleanup",
  "migrate-pointers",
];

export const JOB_LABELS: Record<JobMode, string> = {
  verify: "Verify domains",
  poll: "Poll addresses",
  health: "Check live addresses",
  plan: "Enforce plans",
  cleanup: "Cleanup",
  "migrate-pointers": "Migrate pointers",
};

export const JOB_DESCRIPTIONS: Record<JobMode, string> = {
  verify: "Checks DNS TXT ownership records for pending custom domains.",
  poll: "Polls hostname provisioning and TLS certificate issuance status.",
  health: "Probes live custom hostnames and updates health failure counters.",
  plan: "Enforces plan limits by pausing or restoring custom domains.",
  cleanup: "Expires stale verifications and removes released provider hostnames.",
  "migrate-pointers": "Synchronizes site and host routing pointers in edge storage.",
};

export type StoredRunRow = {
  id: string;
  job: string;
  status: "ok" | "error";
  started_at: string;
  finished_at: string | null;
  duration_ms: number;
  count: number;
  failed: number;
  error: string | null;
  details?: {
    provider?: string | null;
    failed?: number;
    health?: ProviderHealthSnapshot | null;
  } | null;
};

export type StoredErrorLog = {
  id: string;
  timestamp: string;
  job: string;
  targetId: string | null;
  targetLabel: string | null;
  message: string;
  severity: "error" | "warning";
};

export type RunningJobEntry = {
  token: string;
  mode: JobMode;
  startedAt: string;
};

export type ProviderHealthSnapshot = {
  totalRequests?: number;
  totalFailures?: number;
  consecutiveFailures?: number;
  circuitOpenUntil?: string | null;
  lastFailureAt?: string | null;
  lastSuccessAt?: string | null;
};

export type DomainHealthRow = {
  provider: string;
  total_requests: number;
  total_failures: number;
  consecutive_failures: number;
  circuit_open_until: string | null;
  last_failure_at: string | null;
  last_success_at: string | null;
  checked_at: string;
  circuit_open: boolean;
};

export type WorkerStatusSummary = {
  mode: JobMode;
  label: string;
  description: string;
  status: "running" | "healthy" | "error" | "idle";
  activeStartedAt: string | null;
  lastRunAt: string | null;
  lastFinishedAt: string | null;
  lastDurationMs: number | null;
  lastCount: number;
  lastFailed: number;
  lastError: string | null;
  totalRuns: number;
  totalFailures: number;
};

export type OpsMonitorSnapshot = {
  counts: Record<string, number>;
  health: DomainHealthRow | null;
  workers: WorkerStatusSummary[];
  runs: StoredRunRow[];
  errorLogs: StoredErrorLog[];
  running: RunningJobEntry[];
  updatedAt: string;
};

type OpsState = {
  running: RunningJobEntry[];
  runs: StoredRunRow[];
  errorLogs: StoredErrorLog[];
  health: DomainHealthRow | null;
};

const STORE_FILE = "/tmp/get-on-domain-ops.json";
const MAX_RUNS = 120;
const MAX_ERRORS = 200;

const globalForOps = globalThis as typeof globalThis & {
  __getOnDomainOpsState?: OpsState;
};

function readDiskOps(): OpsState | null {
  try {
    if (!existsSync(STORE_FILE)) return null;
    const raw = readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<OpsState>;
    if (parsed && typeof parsed === "object") {
      return {
        running: Array.isArray(parsed.running) ? parsed.running : [],
        runs: Array.isArray(parsed.runs) ? parsed.runs : [],
        errorLogs: Array.isArray(parsed.errorLogs) ? parsed.errorLogs : [],
        health: parsed.health ?? null,
      };
    }
  } catch {
    // Ignore unreadable state file
  }
  return null;
}

function getOpsState(): OpsState {
  if (!globalForOps.__getOnDomainOpsState) {
    globalForOps.__getOnDomainOpsState = readDiskOps() ?? {
      running: [],
      runs: [],
      errorLogs: [],
      health: null,
    };
  }
  return globalForOps.__getOnDomainOpsState;
}

function persistOpsState(state: OpsState): void {
  globalForOps.__getOnDomainOpsState = state;
  try {
    writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Non-fatal in read-only filesystems
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function startTrackedJob(mode: JobMode): string {
  const state = getOpsState();
  const token = makeId(mode);
  state.running = [
    ...state.running.filter(
      (entry) => Date.now() - new Date(entry.startedAt).getTime() < 15 * 60_000,
    ),
    { token, mode, startedAt: new Date().toISOString() },
  ];
  persistOpsState(state);
  return token;
}

export function finishTrackedJob(token: string): void {
  const state = getOpsState();
  state.running = state.running.filter((entry) => entry.token !== token);
  persistOpsState(state);
}

export function appendJobErrorLog(entry: {
  job: string;
  targetId?: string | null;
  targetLabel?: string | null;
  message: string;
  severity?: "error" | "warning";
}): void {
  const state = getOpsState();
  const log: StoredErrorLog = {
    id: makeId("err"),
    timestamp: new Date().toISOString(),
    job: entry.job,
    targetId: entry.targetId ?? null,
    targetLabel: entry.targetLabel ?? null,
    message: entry.message.slice(0, 1000),
    severity: entry.severity ?? "error",
  };
  state.errorLogs = [log, ...state.errorLogs].slice(0, MAX_ERRORS);
  persistOpsState(state);
}

export function recordTrackedRun(input: {
  job: string;
  status: "ok" | "error";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  count: number;
  failed: number;
  error: string | null;
  providerName: string | null;
  health: ProviderHealthSnapshot | null;
}): void {
  const state = getOpsState();
  const row: StoredRunRow = {
    id: makeId("run"),
    job: input.job,
    status: input.status,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    duration_ms: input.durationMs,
    count: input.count,
    failed: input.failed,
    error: input.error,
    details: {
      provider: input.providerName,
      failed: input.failed,
      health: input.health,
    },
  };
  state.runs = [row, ...state.runs].slice(0, MAX_RUNS);

  if (input.health && input.providerName) {
    const openUntil = input.health.circuitOpenUntil ?? null;
    const circuitOpen = Boolean(
      openUntil && new Date(openUntil).getTime() > Date.now(),
    );
    state.health = {
      provider: input.providerName,
      total_requests: input.health.totalRequests ?? 0,
      total_failures: input.health.totalFailures ?? 0,
      consecutive_failures: input.health.consecutiveFailures ?? 0,
      circuit_open_until: openUntil,
      last_failure_at: input.health.lastFailureAt ?? null,
      last_success_at: input.health.lastSuccessAt ?? null,
      checked_at: input.finishedAt,
      circuit_open: circuitOpen,
    };
  }

  persistOpsState(state);
}

function normalizeRun(raw: Record<string, unknown>): StoredRunRow {
  const details =
    raw.details && typeof raw.details === "object"
      ? (raw.details as { failed?: unknown; provider?: unknown; health?: ProviderHealthSnapshot | null })
      : undefined;
  return {
    id: String(raw.id ?? makeId("run")),
    job: String(raw.job ?? "unknown"),
    status: raw.status === "error" ? "error" : "ok",
    started_at: String(raw.started_at ?? new Date().toISOString()),
    finished_at: raw.finished_at ? String(raw.finished_at) : null,
    duration_ms: Number(raw.duration_ms ?? 0),
    count: Number(raw.count ?? 0),
    failed: Number(raw.failed ?? details?.failed ?? 0),
    error: raw.error ? String(raw.error) : null,
    details: details
      ? {
          provider: details.provider ? String(details.provider) : null,
          failed: Number(details.failed ?? 0),
          health: details.health ?? null,
        }
      : null,
  };
}

export function getLocalDomainOpsRaw(): {
  counts: Record<string, number>;
  runs: StoredRunRow[];
  health: DomainHealthRow | null;
} {
  const state = getOpsState();
  return {
    counts: {
      hostnames: 0,
      pending: 0,
      attention: 0,
      review: 0,
    },
    runs: state.runs,
    health: state.health,
  };
}

export function getOpsSnapshot(remoteOps?: {
  counts?: Record<string, number>;
  runs?: unknown[];
  health?: Record<string, unknown> | null;
}): OpsMonitorSnapshot {
  const state = getOpsState();
  const remoteRuns = Array.isArray(remoteOps?.runs)
    ? remoteOps.runs
        .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
        .map(normalizeRun)
    : [];

  // Combine tracked local runs & remote Supabase runs without duplicate started_at+job
  const seenKey = new Set<string>();
  const combinedRuns: StoredRunRow[] = [];
  for (const run of [...state.runs, ...remoteRuns]) {
    const key = `${run.job}:${run.started_at}`;
    if (!seenKey.has(key)) {
      seenKey.add(key);
      combinedRuns.push(run);
    }
  }
  combinedRuns.sort(
    (a, b) =>
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );

  // Merge captured per-item errors with any remote run errors not already captured
  const errorKeys = new Set(
    state.errorLogs.map((e) => `${e.job}:${e.message}`),
  );
  const derivedErrors: StoredErrorLog[] = [];
  for (const run of combinedRuns) {
    if (run.status === "error" && run.error) {
      const key = `${run.job}:${run.error}`;
      if (!errorKeys.has(key)) {
        errorKeys.add(key);
        derivedErrors.push({
          id: `run-err-${run.id}`,
          timestamp: run.finished_at ?? run.started_at,
          job: run.job,
          targetId: null,
          targetLabel: "Job run",
          message: run.error,
          severity: "error",
        });
      }
    }
  }
  const errorLogs = [...state.errorLogs, ...derivedErrors]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, MAX_ERRORS);

  const runningByMode = new Map<JobMode, RunningJobEntry>();
  for (const active of state.running) {
    runningByMode.set(active.mode, active);
  }

  const workers: WorkerStatusSummary[] = ALL_JOB_MODES.map((mode) => {
    const modeRuns = combinedRuns.filter((run) => run.job === mode);
    const latest = modeRuns[0] ?? null;
    const active = runningByMode.get(mode) ?? null;
    const totalFailures = modeRuns.reduce(
      (sum, run) => sum + (run.status === "error" ? Math.max(1, run.failed) : run.failed),
      0,
    );

    let status: WorkerStatusSummary["status"] = "idle";
    if (active) status = "running";
    else if (latest?.status === "error") status = "error";
    else if (latest?.status === "ok") status = "healthy";

    return {
      mode,
      label: JOB_LABELS[mode],
      description: JOB_DESCRIPTIONS[mode],
      status,
      activeStartedAt: active?.startedAt ?? null,
      lastRunAt: latest?.started_at ?? null,
      lastFinishedAt: latest?.finished_at ?? null,
      lastDurationMs: latest ? latest.duration_ms : null,
      lastCount: latest?.count ?? 0,
      lastFailed: latest?.failed ?? 0,
      lastError: latest?.error ?? null,
      totalRuns: modeRuns.length,
      totalFailures,
    };
  });

  const health =
    (remoteOps?.health as DomainHealthRow | null | undefined) ?? state.health;

  return {
    counts: remoteOps?.counts ?? {
      hostnames: 0,
      pending: 0,
      attention: 0,
      review: 0,
    },
    health: health ?? null,
    workers,
    runs: combinedRuns.slice(0, MAX_RUNS),
    errorLogs,
    running: state.running,
    updatedAt: new Date().toISOString(),
  };
}
