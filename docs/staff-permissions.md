# Staff permissions

Generated from `packages/permissions/src/staff-matrix.ts`. Do not edit by hand.
Run `pnpm --filter web staff:docs` after changing the matrix.

Two platform staff roles: **Super admin** and **Customer success**. Team roles (Owner, Admin, Editor, Viewer) are separate customer roles and are not covered here.

## Matrix

| Permission | Super admin | Customer success |
|---|---|---|
| See the staff team (`staff.view`) | Yes | Yes |
| Add staff, change roles, remove staff (`staff.manage`) | Yes | — |
| Reset a staff member's authenticator (`staff.mfa_reset`) | Yes | — |
| Read the staff audit log (`staff.audit.view`) | Yes | — |
| Change platform settings (`platform.settings`) | Yes | — |
| Use platform kill switches (`platform.kill_switches`) | Yes | — |
| See job health and errors (`platform.jobs.view`) | Yes | Yes |
| Retry a job (`platform.jobs.retry`) | Yes | — |
| Manage an incident banner (`platform.incident.manage`) | Yes | — |
| Search accounts, teams and websites (`account.search`) | Yes | Yes |
| View account metadata (with a purpose) (`account.view`) | Yes | Yes |
| Write customer notes (`account.note`) | Yes | Yes |
| Message a customer (`account.message`) | Yes | Yes |
| Export account metadata (`account.export`) | Yes | — |
| Request account deletion (`account.delete.request`) | Yes | Yes |
| Approve account deletion (`account.delete.approve`) | Yes | — |
| Clear a sign-in lockout (`account.lockout.clear`) | Yes | Yes |
| Sign a customer out everywhere (`account.sessions.revoke`) | Yes | Yes |
| Rebuild entitlements (`account.entitlements.rebuild`) | Yes | Yes |
| Request free access (`access.free.request`) | Yes | Yes |
| Approve free access (`access.free.approve`) | Yes | — |
| Give free access directly (`access.free.direct`) | Yes | — |
| View billing metadata (`billing.view`) | Yes | Yes |
| Check payment status (`billing.payment_status`) | Yes | Yes |
| View invoices (masked) (`billing.invoice.view`) | Yes | Yes |
| Open invoice PDFs (`billing.invoice.pdf`) | Yes | — |
| Resend an invoice (`billing.invoice.resend`) | Yes | Yes |
| Resend a receipt (`billing.receipt.resend`) | Yes | Yes |
| Resend a coupon (`billing.coupon.resend`) | Yes | Yes |
| Clear a coupon (`billing.coupon.clear`) | Yes | Yes |
| Request an invoice void (`billing.invoice.void.request`) | Yes | Yes |
| Approve an invoice void (`billing.invoice.void.approve`) | Yes | — |
| Void an invoice directly (`billing.invoice.void.direct`) | Yes | — |
| Request a refund (`billing.refund.request`) | Yes | Yes |
| Approve a refund (`billing.refund.approve`) | Yes | — |
| Refund directly (`billing.refund.direct`) | Yes | — |
| Request a manual payment (`billing.manual_payment.request`) | Yes | Yes |
| Approve a manual payment (`billing.manual_payment.approve`) | Yes | — |
| Record a manual payment directly (`billing.manual_payment.direct`) | Yes | — |
| Request a credit adjustment (`billing.credit_adjust.request`) | Yes | Yes |
| Approve a credit adjustment (`billing.credit_adjust.approve`) | Yes | — |
| Adjust credit directly (`billing.credit_adjust.direct`) | Yes | — |
| Request more grace time (`billing.grace_extend.request`) | Yes | Yes |
| Approve more grace time (`billing.grace_extend.approve`) | Yes | — |
| Extend grace directly (`billing.grace_extend.direct`) | Yes | — |
| Request a billing hold (`billing.hold.request`) | Yes | Yes |
| Approve a billing hold (`billing.hold.approve`) | Yes | — |
| Place a billing hold directly (`billing.hold.direct`) | Yes | — |
| Change prices and plans (`billing.price.manage`) | Yes | — |
| Create coupons (`billing.coupon.create`) | Yes | — |
| See full tax ids (`billing.tax_id.view_full`) | Yes | — |
| View AI credit summaries (`ai.view`) | Yes | Yes |
| Request AI credits (`ai.credits.request`) | Yes | Yes |
| Approve AI credits (`ai.credits.approve`) | Yes | — |
| Add AI credits directly (`ai.credits.direct`) | Yes | — |
| Request an AI limit (`ai.limits.request`) | Yes | Yes |
| Approve an AI limit (`ai.limits.approve`) | Yes | — |
| Change AI settings and models (`ai.settings`) | Yes | — |
| Search websites (`website.search`) | Yes | Yes |
| View website metadata (with a purpose) (`website.view`) | Yes | Yes |
| Flag a website (`website.flag`) | Yes | Yes |
| Request a takedown (`website.takedown.request`) | Yes | Yes |
| Approve a takedown (`website.takedown.approve`) | Yes | — |
| Take a website down directly (`website.takedown.direct`) | Yes | — |
| Request reinstatement (`website.reinstate.request`) | Yes | Yes |
| Approve reinstatement (`website.reinstate.approve`) | Yes | — |
| Reinstate a website directly (`website.reinstate.direct`) | Yes | — |
| See moderation evidence (`website.moderation.evidence`) | Yes | Yes |
| Decide a moderation review (`website.moderation.decide`) | Yes | Yes |
| Request a plan pause (`website.plan_pause.request`) | Yes | Yes |
| Approve a plan pause (`website.plan_pause.approve`) | Yes | — |
| View domains (`domain.view`) | Yes | Yes |
| Re-check a domain now (`domain.recheck`) | Yes | Yes |
| Request a domain review (`domain.review.request`) | Yes | Yes |
| Approve a domain review (`domain.review.approve`) | Yes | — |
| Request a plan lapse pause (`domain.plan_lapse.request`) | Yes | Yes |
| Approve a plan lapse pause (`domain.plan_lapse.approve`) | Yes | — |
| Request a domain removal (`domain.remove.request`) | Yes | Yes |
| Approve a domain removal (`domain.remove.approve`) | Yes | — |
| Manage system templates (`template.system.manage`) | Yes | — |
| View email delivery logs (`email.view`) | Yes | Yes |
| Resend a system email (`email.resend`) | Yes | Yes |
| Manage the suppression list (`email.suppression.manage`) | Yes | — |
| Send a test email (`email.send_test`) | Yes | — |
| View marketing campaigns (`marketing.view`) | Yes | Yes |
| Create a campaign (`marketing.campaign.create`) | Yes | — |
| Send a campaign (`marketing.campaign.send`) | Yes | — |
| Approve a campaign (`marketing.campaign.approve`) | Yes | — |
| View segments and counts (`marketing.segment.view`) | Yes | Yes |
| Export marketing data (`marketing.export`) | Yes | — |
| Change marketing settings (`marketing.settings`) | Yes | — |
| View reports (`reports.view`) | Yes | Yes |
| Export reports (`reports.export`) | Yes | — |
| View the finance report (`finance.view`) | Yes | — |
| Close a finance month (`finance.close`) | Yes | — |
| View support cases (`support.case.view`) | Yes | Yes |
| Assign a case (`support.case.assign`) | Yes | Yes |
| Close a case (`support.case.close`) | Yes | Yes |
| Reopen a case (`support.case.reopen`) | Yes | Yes |
| Escalate a case (`support.case.escalate`) | Yes | Yes |
| Write internal notes (`support.note.internal`) | Yes | Yes |
| Manage help articles (`support.kb.manage`) | Yes | — |
| Manage canned replies (`support.canned.manage`) | Yes | Yes |
| View abuse reports (`abuse.view`) | Yes | Yes |
| Decide an abuse report (`abuse.decide`) | Yes | Yes |
| View demo requests (`demo.view`) | Yes | Yes |
| Update demo requests (`demo.update`) | Yes | Yes |
| Change notification settings (`notification.settings`) | Yes | — |

## Rules

- Every staff check goes through `staffCan` / `staffRequire` and the SQL `staff_can` function. Never compare a role string directly.
- Customer success can search, view metadata with a purpose, note, message, run cases, check payment status, resend system emails, rebuild entitlements, clear a coupon or a sign-in lockout, and update demo requests.
- Everything that changes money, access, credits, plans or a website is a request for a super admin. Customer success never performs those directly.
- Super admin is the only role for staff management, kill switches, prices, coupons, AI settings, system templates, marketing sends, exports and finance closes.
- Dual control applies above the thresholds below and, for the listed kinds, whenever two or more super admins exist.

## Approvals

- Requests expire after 72 hours.
- At most 20 open requests per customer success member.
- A reason of at least 10 characters is required to request, and 10 to decide.
- The decider is never the requester.
- Refund above USD 200 needs two super admins.
- Manual payment above USD 500 needs two super admins.
- Credit adjustment above USD 100.
- AI credits above 1000 credits.
- Grace can be extended directly by up to 90 days; longer needs approval.

## Sessions

- Staff must use an authenticator app (AAL2) before any staff screen or function.
- Idle timeout 30 minutes; absolute session 8 hours.
- Sensitive actions need re-authentication within 15 minutes.
- A customer record access window is 60 minutes and needs a purpose.
