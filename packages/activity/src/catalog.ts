export type ActivityCategory =
  | "website" | "page" | "design" | "pictures" | "settings" | "domain"
  | "plugin" | "template" | "backup" | "ai" | "member" | "invitation"
  | "team" | "referral" | "security";

export type ActivityEvent = {
  id: string;
  category: ActivityCategory;
  label: string;
  coalesceWindowSeconds?: number;
  ownerOnly?: boolean;
};

export const activityEvents: ActivityEvent[] = [
  { id: "website_created", category: "website", label: "Website created" },
  { id: "website_renamed", category: "website", label: "Website renamed" },
  { id: "website_deleted", category: "website", label: "Website deleted" },
  { id: "website_restored", category: "website", label: "Website restored" },
  { id: "website_purged", category: "website", label: "Website permanently deleted" },
  { id: "website_transfer_requested", category: "website", label: "Website transfer requested" },
  { id: "website_transfer_cancelled", category: "website", label: "Website transfer cancelled" },
  { id: "website_transfer_declined", category: "website", label: "Website transfer declined" },
  { id: "website_transfer_expired", category: "website", label: "Website transfer expired" },
  { id: "website_transferred_out", category: "website", label: "Website sent to another team" },
  { id: "website_transferred_in", category: "website", label: "Website received" },
  { id: "website_published", category: "website", label: "Website published" },
  { id: "website_unpublished", category: "website", label: "Website taken offline" },
  { id: "website_rolled_back", category: "website", label: "Website rolled back" },
  { id: "website_paused", category: "website", label: "Website paused" },
  { id: "website_resumed", category: "website", label: "Website resumed" },
  { id: "website_suspended", category: "website", label: "Website suspended" },
  { id: "page_created", category: "page", label: "Page created" },
  { id: "page_deleted", category: "page", label: "Page deleted" },
  { id: "page_renamed", category: "page", label: "Page renamed" },
  { id: "page_reordered", category: "page", label: "Pages reordered", coalesceWindowSeconds: 600 },
  { id: "page_hidden", category: "page", label: "Page hidden" },
  { id: "page_shown", category: "page", label: "Page shown" },
  { id: "page_edited", category: "page", label: "Page edited", coalesceWindowSeconds: 1800 },
  { id: "shared_section_edited", category: "page", label: "Shared section edited", coalesceWindowSeconds: 1800 },
  { id: "page_restored_version", category: "page", label: "Earlier page version restored" },
  { id: "design_changed", category: "design", label: "Design changed", coalesceWindowSeconds: 900 },
  { id: "template_applied", category: "design", label: "Template used" },
  { id: "media_uploaded", category: "pictures", label: "Pictures added", coalesceWindowSeconds: 1800 },
  { id: "media_deleted", category: "pictures", label: "Picture deleted" },
  { id: "media_replaced", category: "pictures", label: "Picture replaced" },
  { id: "settings_changed", category: "settings", label: "Settings changed", coalesceWindowSeconds: 600 },
  { id: "redirect_added", category: "settings", label: "Redirect added" },
  { id: "redirect_removed", category: "settings", label: "Redirect removed" },
  { id: "verification_changed", category: "settings", label: "Verification changed" },
  { id: "analytics_changed", category: "settings", label: "Analytics changed" },
  { id: "domain_started", category: "domain", label: "Domain started" },
  { id: "domain_verified", category: "domain", label: "Domain verified" },
  { id: "domain_live", category: "domain", label: "Domain live" },
  { id: "domain_attention", category: "domain", label: "Domain needs attention" },
  { id: "domain_removed", category: "domain", label: "Domain removed" },
  { id: "domain_main_changed", category: "domain", label: "Main address changed" },
  { id: "domain_plan_lapsed", category: "domain", label: "Domain paused by plan" },
  { id: "domain_plan_restored", category: "domain", label: "Domain restored by plan" },
  { id: "plugin_enabled", category: "plugin", label: "Plugin turned on" },
  { id: "plugin_disabled", category: "plugin", label: "Plugin turned off" },
  { id: "plugin_locked", category: "plugin", label: "Plugin locked" },
  { id: "template_created", category: "template", label: "Template created" },
  { id: "template_edited", category: "template", label: "Template edited", coalesceWindowSeconds: 1800 },
  { id: "template_deleted", category: "template", label: "Template deleted" },
  { id: "template_saved_from_site", category: "template", label: "Template saved from website" },
  { id: "backup_created", category: "backup", label: "Backup created" },
  { id: "backup_auto", category: "backup", label: "Automatic backup" },
  { id: "backup_failed", category: "backup", label: "Backup failed" },
  { id: "backup_restored", category: "backup", label: "Backup restored" },
  { id: "export_created", category: "backup", label: "Export created" },
  { id: "import_done", category: "backup", label: "Import finished" },
  { id: "ai_site_written", category: "ai", label: "AI wrote a website" },
  { id: "ai_page_written", category: "ai", label: "AI wrote a page" },
  { id: "ai_template_written", category: "ai", label: "AI wrote a template" },
  { id: "ai_text_used", category: "ai", label: "AI wrote text", coalesceWindowSeconds: 3600 },
  { id: "ai_credits_granted", category: "ai", label: "AI credits added" },
  { id: "ai_limit_set", category: "ai", label: "AI limit set" },
  { id: "member_joined", category: "member", label: "Member joined" },
  { id: "member_left", category: "member", label: "Member left" },
  { id: "member_removed", category: "member", label: "Member removed" },
  { id: "member_role_changed", category: "member", label: "Member role changed" },
  { id: "member_paused", category: "member", label: "Member paused" },
  { id: "member_restored", category: "member", label: "Member restored" },
  { id: "team_ownership_transferred", category: "member", label: "Ownership transferred" },
  { id: "invite_sent", category: "invitation", label: "Invitation sent" },
  { id: "invite_resent", category: "invitation", label: "Invitation resent" },
  { id: "invite_revoked", category: "invitation", label: "Invitation cancelled" },
  { id: "invite_accepted", category: "invitation", label: "Invitation accepted" },
  { id: "invite_declined", category: "invitation", label: "Invitation declined" },
  { id: "invite_expired", category: "invitation", label: "Invitation expired" },
  { id: "team_renamed", category: "team", label: "Team renamed" },
  { id: "plan_changed", category: "team", label: "Plan changed" },
  { id: "seats_changed", category: "team", label: "Seats changed" },
  { id: "referral_joined", category: "referral", label: "Friend joined" },
  { id: "referral_qualified", category: "referral", label: "Referral counted" },
  { id: "referral_reward_applied", category: "referral", label: "Referral reward added" },
  { id: "referral_reward_claimed", category: "referral", label: "Referral reward claimed" },
  { id: "role_changed", category: "security", label: "Role changed" },
  { id: "ownership_transferred", category: "security", label: "Ownership transferred" },
  { id: "site_deleted_forever", category: "security", label: "Website permanently deleted" },
  { id: "site_transferred", category: "security", label: "Website transferred" },
  { id: "support_access", category: "security", label: "Support opened the team" },
  { id: "page.edited", category: "page", label: "Page edited", coalesceWindowSeconds: 1800 },
  { id: "project.details_updated", category: "website", label: "Website details changed" },
  { id: "redirect.added", category: "settings", label: "Redirect added" },
  { id: "redirect.removed", category: "settings", label: "Redirect removed" },
  { id: "settings.analytics_updated", category: "settings", label: "Analytics changed" },
  { id: "settings.business_updated", category: "settings", label: "Business details changed" },
  { id: "settings.not_found_updated", category: "settings", label: "Page-not-found settings changed" },
  { id: "settings.search_updated", category: "settings", label: "Search settings changed" },
  { id: "settings.sitemap_updated", category: "settings", label: "Sitemap changed" },
  { id: "settings.writing_updated", category: "settings", label: "Writing settings changed" }
];

const byId = new Map(activityEvents.map((event) => [event.id, event]));

export function activityEvent(id: string): ActivityEvent | undefined {
  return byId.get(id);
}

export function describeActivity(row: { summary: string }): string {
  return row.summary;
}
