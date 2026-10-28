import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  approvalRules,
  staffActionIds,
  staffActionLabels,
  staffMatrix,
  staffRoleLabels,
  staffRoles,
} from "@get-on/permissions";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const outDir = resolve(root, "docs");
mkdirSync(outDir, { recursive: true });

const lines: string[] = [];
lines.push("# Staff permissions");
lines.push("");
lines.push("Generated from `packages/permissions/src/staff-matrix.ts`. Do not edit by hand.");
lines.push("Run `pnpm --filter web staff:docs` after changing the matrix.");
lines.push("");
lines.push("Two platform staff roles: **Super admin** and **Customer success**. Team roles (Owner, Admin, Editor, Viewer) are separate customer roles and are not covered here.");
lines.push("");
lines.push("## Matrix");
lines.push("");
lines.push(`| Permission | ${staffRoles.map((role) => staffRoleLabels[role]).join(" | ")} |`);
lines.push(`|---|${staffRoles.map(() => "---").join("|")}|`);
for (const action of staffActionIds) {
  const cells = staffRoles.map((role) => (staffMatrix[action][role] ? "Yes" : "—"));
  lines.push(`| ${staffActionLabels[action]} (\`${action}\`) | ${cells.join(" | ")} |`);
}
lines.push("");
lines.push("## Rules");
lines.push("");
lines.push("- Every staff check goes through `staffCan` / `staffRequire` and the SQL `staff_can` function. Never compare a role string directly.");
lines.push("- Customer success can search, view metadata with a purpose, note, message, run cases, check payment status, resend system emails, rebuild entitlements, clear a coupon or a sign-in lockout, and update demo requests.");
lines.push("- Everything that changes money, access, credits, plans or a website is a request for a super admin. Customer success never performs those directly.");
lines.push("- Super admin is the only role for staff management, kill switches, prices, coupons, AI settings, system templates, marketing sends, exports and finance closes.");
lines.push("- Dual control applies above the thresholds below and, for the listed kinds, whenever two or more super admins exist.");
lines.push("");
lines.push("## Approvals");
lines.push("");
lines.push(`- Requests expire after ${approvalRules.expiryHours} hours.`);
lines.push(`- At most ${approvalRules.maxOpenPerMember} open requests per customer success member.`);
lines.push(`- A reason of at least ${approvalRules.reasonMinChars} characters is required to request, and ${approvalRules.decisionReasonMinChars} to decide.`);
lines.push(`- The decider is never the requester.`);
lines.push(`- Refund above USD ${approvalRules.thresholds.refundDualUsd} needs two super admins.`);
lines.push(`- Manual payment above USD ${approvalRules.thresholds.manualPaymentDualUsd} needs two super admins.`);
lines.push(`- Credit adjustment above USD ${approvalRules.thresholds.creditAdjustDual}.`);
lines.push(`- AI credits above ${approvalRules.thresholds.aiCreditsDual} credits.`);
lines.push(`- Grace can be extended directly by up to ${approvalRules.thresholds.graceExtendDirectDays} days; longer needs approval.`);
lines.push("");
lines.push("## Sessions");
lines.push("");
lines.push(`- Staff must use an authenticator app (AAL2) before any staff screen or function.`);
lines.push(`- Idle timeout ${approvalRules.idleMinutes} minutes; absolute session ${approvalRules.absoluteSessionHours} hours.`);
lines.push(`- Sensitive actions need re-authentication within ${approvalRules.reauthMinutes} minutes.`);
lines.push(`- A customer record access window is ${approvalRules.accessSessionMinutes} minutes and needs a purpose.`);
lines.push("");

writeFileSync(resolve(outDir, "staff-permissions.md"), lines.join("\n"), "utf8");
console.log(`Wrote ${resolve(outDir, "staff-permissions.md")}`);

const rows: string[] = [];
for (const action of staffActionIds) {
  for (const role of staffRoles) {
    rows.push(`  ('${role}', '${action}', ${staffMatrix[action][role] ? "true" : "false"})`);
  }
}

const sql = [
  "-- Generated from packages/permissions/src/staff-matrix.ts.",
  "-- Run `pnpm --filter web staff:docs` after changing the matrix.",
  "",
  "insert into public.staff_permissions (role, action, allowed) values",
  rows.join(",\n"),
  "on conflict (role, action) do update set allowed = excluded.allowed;",
  "",
].join("\n");

const migrationsDir = resolve(root, "supabase/migrations");
mkdirSync(migrationsDir, { recursive: true });
const sqlPath = resolve(migrationsDir, "20261103000200_staff_permissions_seed.sql");
writeFileSync(sqlPath, sql, "utf8");
console.log(`Wrote ${sqlPath}`);
