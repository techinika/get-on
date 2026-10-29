import { daysUntil } from "@get-on/billing";
import {
  notifyDebt,
  notifyGraceStarted,
  notifyInvoiceExpired,
  notifyLapsed,
  notifyRenewalReminder,
} from "../../lib/billing/email";
import { getBillingSettings, refreshTeamBilling } from "../../lib/billing/service";
import { paymentProviderName } from "../../lib/billing/provider";
import { getPaymentProvider } from "../../lib/billing";
import { createAdminClient } from "../../lib/supabase/admin";

async function teamOnHold(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  now: Date,
): Promise<boolean> {
  const { data: holds } = await admin
    .from("billing_holds")
    .select("ends_at")
    .eq("team_id", teamId)
    .is("released_at", null);
  return (holds ?? []).some(
    (hold) => !hold.ends_at || new Date(String(hold.ends_at)) > now,
  );
}

async function main() {
  const admin = createAdminClient();
  const now = new Date();
  const settings = await getBillingSettings();
  let expired = 0;
  let refreshed = 0;
  let reminded = 0;
  let notices = 0;

  if (paymentProviderName() === "pesapal" && !settings.pesapalIpnId) {
    try {
      const provider = getPaymentProvider();
      const url =
        process.env.PESAPAL_IPN_URL ??
        `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://get-on.tech"}/api/billing/pesapal/ipn`;
      if (provider.registerIpn) {
        const ipn = await provider.registerIpn(url);
        await admin
          .from("billing_settings")
          .update({ pesapal_ipn_id: ipn.notificationId, updated_at: now.toISOString() })
          .eq("id", 1);
        settings.pesapalIpnId = ipn.notificationId;
      }
    } catch (error) {
      console.error("[billing] IPN registration failed", error);
    }
  }

  await admin
    .from("subscription_terms")
    .update({ status: "ended" })
    .lte("ends_at", now.toISOString())
    .in("status", ["active", "upcoming"]);
  await admin
    .from("subscription_terms")
    .update({ status: "active" })
    .lte("starts_at", now.toISOString())
    .gt("ends_at", now.toISOString())
    .eq("status", "upcoming");

  const { data: expiredInvoices } = await admin
    .from("invoices")
    .select("id, team_id, number")
    .in("status", ["open", "payment_pending"])
    .lt("expires_at", now.toISOString())
    .limit(500);
  for (const invoice of expiredInvoices ?? []) {
    const { error } = await admin
      .from("invoices")
      .update({ status: "expired", updated_at: now.toISOString() })
      .eq("id", invoice.id)
      .in("status", ["open", "payment_pending"]);
    if (error) continue;
    await admin
      .from("coupon_redemptions")
      .update({ status: "released", released_at: now.toISOString() })
      .eq("invoice_id", invoice.id)
      .eq("status", "reserved");
    expired += 1;
    if (!(await teamOnHold(admin, String(invoice.team_id), now))) {
      await notifyInvoiceExpired({
        teamId: String(invoice.team_id),
        invoiceId: String(invoice.id),
        number: String(invoice.number),
      }).catch(() => undefined);
    }
  }

  let from = 0;
  const pageSize = 200;
  for (;;) {
    const { data: teams, error } = await admin
      .from("teams")
      .select("id")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!teams || teams.length === 0) break;

    for (const team of teams) {
      const teamId = String(team.id);
      try {
        const access = await refreshTeamBilling(teamId);
        refreshed += 1;

        if (await teamOnHold(admin, teamId, now)) continue;

        if (access.status === "active" && access.paidThrough) {
          const left = daysUntil(new Date(access.paidThrough), now);
          for (const threshold of settings.reminderDays) {
            if (left <= threshold) {
              await notifyRenewalReminder({
                teamId,
                paidThrough: access.paidThrough,
                daysLeft: left,
                threshold,
              }).catch(() => undefined);
              reminded += 1;
            }
          }
        }

        if (access.status === "grace" && access.paidThrough) {
          await notifyGraceStarted({
            teamId,
            paidThrough: access.paidThrough,
            graceEndsAt: access.graceEndsAt,
          }).catch(() => undefined);
          notices += 1;
        }

        if (access.status === "lapsed" && access.paidThrough) {
          await notifyLapsed({ teamId, paidThrough: access.paidThrough }).catch(
            () => undefined,
          );
          notices += 1;
        }

        if (access.debtCents > 0) {
          await notifyDebt({
            teamId,
            debtCents: access.debtCents,
            currency: "USD",
          }).catch(() => undefined);
          notices += 1;
        }
      } catch (error) {
        console.error(`[billing] team ${teamId} failed`, error);
      }
    }

    if (teams.length < pageSize) break;
    from += pageSize;
  }

  console.log(
    `[billing] expired=${expired} refreshed=${refreshed} reminded=${reminded} notices=${notices}`,
  );
}

main().catch((error) => {
  console.error("[billing] job failed", error);
  process.exitCode = 1;
});
