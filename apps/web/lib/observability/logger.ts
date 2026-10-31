import { createHmac } from "node:crypto";

/* Structured logger for the email platform (and other platform services).

Design decisions (recorded in docs/fixes-report.md):
- No external logging library was available offline, so this is a small
  dependency-free structured logger. Levels: debug < info < warn < error.
- Production emits JSON lines to stdout. Development emits a coloured, single
  line per stage so `pnpm dev` output stays readable.
- EMAIL_LOG_LEVEL sets the floor (default debug in development, info in
  production). EMAIL_DEBUG_TRACE=<traceId> forces debug for a single trace.
- Redaction is a hard rule: codes, tokens, links, credentials, message bodies
  and full addresses are never logged. Addresses are masked ab***@domain.com.
  The only exception is ConsoleSender in development with EMAIL_TRANSPORT=console,
  which may print a clearly marked DEV ONLY block.
*/

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const COLOURS: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

function levelFromEnv(): LogLevel {
  const forced = process.env.EMAIL_LOG_LEVEL;
  if (forced && LEVEL_ORDER[forced as LogLevel] !== undefined) {
    return forced as LogLevel;
  }
  return isDev() ? "debug" : "info";
}

const FLOOR: LogLevel = levelFromEnv();

function shouldLog(level: LogLevel, traceId?: string | null): boolean {
  // EMAIL_DEBUG_TRACE forces debug for a single trace even when the floor is higher.
  if (
    traceId &&
    process.env.EMAIL_DEBUG_TRACE &&
    traceId.includes(process.env.EMAIL_DEBUG_TRACE)
  ) {
    return true;
  }
  return LEVEL_ORDER[level] >= LEVEL_ORDER[FLOOR];
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function maskEmail(value: unknown): string {
  const text = String(value ?? "");
  return text.replace(EMAIL_RE, (address) => {
    const [local, domain] = address.split("@");
    const maskedLocal = local.length > 2 ? local.slice(0, 2) + "***" : "***";
    return `${maskedLocal}@${domain}`;
  });
}

const SECRET_KEYS: string[] = [
  "code",
  "token",
  "secret",
  "password",
  "otp",
  "link",
  "url",
  "authorization",
  "cookie",
  "session",
  "challenge",
  "pepper",
  "key",
];

const LINK_LIKE = /https?:\/\/[^\s"<>]+/g;

function redactValue(key: string, value: unknown): unknown {
  const k = String(key ?? "").toLowerCase();
  if (SECRET_KEYS.includes(k) || SECRET_KEYS.some((s) => k.includes(s))) {
    if (k === "url" || k === "link") return "[redacted]";
    return "[redacted]";
  }
  if (typeof value === "string") {
    if (EMAIL_RE.test(value)) return maskEmail(value);
    if (LINK_LIKE.test(value)) return "[redacted]";
    return value;
  }
  if (Array.isArray(value)) return value.map((item, i) => redactValue(String(i), item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [subKey, subValue] of Object.entries(value)) {
      out[subKey] = redactValue(subKey, subValue);
    }
    return out;
  }
  return value;
}

export function redact(input: unknown): unknown {
  return redactValue("root", input);
}

function escapeCsv(value: string): string {
  return String(value).replace(/"/g, '""');
}

function renderDev(entry: LogEntry): string {
  const ts = new Date(entry.ts).toISOString().slice(11, 23);
  const colour = COLOURS[entry.level];
  const parts: string[] = [];
  parts.push(`${colour}[${entry.level.toUpperCase()}]${RESET}`);
  parts.push(`${ts}`);
  if (entry.service) parts.push(`svc=${entry.service}`);
  if (entry.env) parts.push(`env=${entry.env}`);
  if (entry.trace) parts.push(`trace=${entry.trace}`);
  if (entry.stage) parts.push(`stage=${entry.stage}`);
  if (entry.event) parts.push(`event=${entry.event}`);
  if (entry.template) parts.push(`template=${entry.template}`);
  if (entry.stream) parts.push(`stream=${entry.stream}`);
  if (entry.outboxId) parts.push(`outboxId=${entry.outboxId}`);
  if (entry.emailLogId) parts.push(`emailLogId=${entry.emailLogId}`);
  if (entry.jobRun) parts.push(`jobRun=${entry.jobRun}`);
  if (entry.attempt !== undefined) parts.push(`attempt=${entry.attempt}`);
  if (entry.toMasked !== undefined) parts.push(`to=${maskEmail(entry.toMasked)}`);
  if (entry.toCount !== undefined) parts.push(`toCount=${entry.toCount}`);
  if (entry.reason) parts.push(`reason=${entry.reason}`);
  if (entry.code) parts.push(`code=${entry.code}`);
  if (entry.httpStatus) parts.push(`httpStatus=${entry.httpStatus}`);
  if (entry.retryable !== undefined) parts.push(`retryable=${entry.retryable}`);
  if (entry.durationMs !== undefined) parts.push(`${entry.durationMs}ms`);
  if (entry.messageId) parts.push(`messageId=${entry.messageId}`);
  if (entry.configSet) parts.push(`configSet=${entry.configSet}`);
  if (entry.fromIdentity) parts.push(`from=${maskEmail(entry.fromIdentity)}`);
  if (entry.sandbox !== undefined) parts.push(`sandbox=${entry.sandbox}`);
  if (entry.msg) parts.push(`msg=${escapeCsv(entry.msg)}`);
  if (entry.meta) {
    const meta = JSON.stringify(redact(entry.meta));
    if (meta !== "{}") parts.push(`meta=${meta}`);
  }
  return parts.join(" ");
}

function renderProd(entry: LogEntry): string {
  const out: Record<string, unknown> = {
    ts: entry.ts,
    level: entry.level,
    msg: entry.msg ?? "",
    service: entry.service,
    env: entry.env,
  };
  if (entry.trace) out.trace = entry.trace;
  if (entry.stage) out.stage = entry.stage;
  if (entry.event) out.event = entry.event;
  if (entry.template) out.template = entry.template;
  if (entry.stream) out.stream = entry.stream;
  if (entry.outboxId) out.outbox_id = entry.outboxId;
  if (entry.emailLogId) out.email_log_id = entry.emailLogId;
  if (entry.jobRun) out.job_run = entry.jobRun;
  if (entry.attempt !== undefined) out.attempt = entry.attempt;
  if (entry.toMasked !== undefined) out.to_masked = maskEmail(entry.toMasked);
  if (entry.toCount !== undefined) out.to_count = entry.toCount;
  if (entry.reason) out.reason = entry.reason;
  if (entry.code) out.code = entry.code;
  if (entry.httpStatus) out.http_status = entry.httpStatus;
  if (entry.retryable !== undefined) out.retryable = entry.retryable;
  if (entry.durationMs !== undefined) out.duration_ms = entry.durationMs;
  if (entry.messageId) out.message_id = entry.messageId;
  if (entry.configSet) out.config_set = entry.configSet;
  if (entry.fromIdentity) out.from_masked = maskEmail(entry.fromIdentity);
  if (entry.sandbox !== undefined) out.sandbox = entry.sandbox;
  if (entry.meta) out.meta = redact(entry.meta);
  return JSON.stringify(out);
}

export interface LogEntry {
  ts: string;
  level: LogLevel;
  msg?: string;
  service?: string;
  env?: string;
  trace?: string;
  stage?: string;
  event?: string;
  template?: string;
  stream?: string;
  outboxId?: string;
  emailLogId?: string;
  jobRun?: string;
  attempt?: number;
  toMasked?: string;
  toCount?: number;
  reason?: string;
  code?: string;
  httpStatus?: number;
  retryable?: boolean;
  durationMs?: number;
  messageId?: string;
  configSet?: string;
  fromIdentity?: string;
  sandbox?: boolean;
  meta?: Record<string, unknown>;
}

export class Logger {
  private readonly service: string;
  private readonly env: string;
  private readonly bindings: Record<string, unknown>;

  constructor(service: string, env: string, bindings: Record<string, unknown> = {}) {
    this.service = service;
    this.env = env;
    this.bindings = bindings;
  }

  child(bindings: Record<string, unknown>): Logger {
    return new Logger(this.service, this.env, { ...this.bindings, ...bindings });
  }

  private emit(level: LogLevel, fields: Partial<LogEntry> & { msg?: string }): void {
    if (!shouldLog(level, fields.trace)) return;
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      service: this.service,
      env: this.env,
      ...this.bindings,
      ...fields,
    };
    const line = isDev() ? renderDev(entry) : renderProd(entry);
    const stream = level === "error" ? process.stderr : process.stdout;
    stream.write(line + "\n");
  }

  debug(fields: Partial<LogEntry> & { msg?: string } = {}): void {
    this.emit("debug", fields);
  }

  info(fields: Partial<LogEntry> & { msg?: string } = {}): void {
    this.emit("info", fields);
  }

  warn(fields: Partial<LogEntry> & { msg?: string } = {}): void {
    this.emit("warn", fields);
  }

  error(fields: Partial<LogEntry> & { msg?: string } = {}): void {
    this.emit("error", fields);
  }
}

const DEFAULT_ENV = isDev() ? "development" : "production";
export const platformLogger = new Logger("get-on", DEFAULT_ENV);
export const emailLogger = platformLogger.child({ service: "email" });

export function traceId(): string {
  return `${Date.now().toString(36)}-${createHmac("sha256", Buffer.from(String(Math.random()), "utf8")).digest("hex").slice(0, 12)}`;
}
