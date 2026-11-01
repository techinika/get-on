import { redirect } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { AppCard } from "@/components/app/card";
import { SettingsSection } from "@/components/app/settings-section";
import { Badge } from "@/components/ui/badge";
import { MarketingPreference, PasswordForm, ProfileForm } from "@/components/app/account-forms";
import { AppearanceSetting } from "@/components/app/appearance-setting";
import { DeleteAccount } from "@/components/app/delete-account";
import { getShellData } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const supabase = await createClient();
  const [{ data: preferences }, { data: factors }] = await Promise.all([
    supabase
      .from("email_preferences")
      .select("marketing_opt_in")
      .eq("user_id", data.user.id)
      .maybeSingle(),
    supabase.auth.mfa.listFactors(),
  ]);
  const authenticator = factors?.totp.find((factor) => factor.status === "verified") ?? null;
  const authenticatorSince = authenticator?.created_at
    ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(authenticator.created_at),
      )
    : null;

  return (
    <AppPage width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Account" }]}
        title="Account"
        description="Your personal details and settings."
      />

      <AppCard className="px-6">
        <SettingsSection
          title="Profile"
          description="How we address you and where we send your receipts."
        >
          <ProfileForm fullName={data.user.name} email={data.user.email} />
        </SettingsSection>

        <SettingsSection
          title="Email preferences"
          description="Choose whether we can send you product news and tips."
        >
          <MarketingPreference enabled={Boolean(preferences?.marketing_opt_in)} />
        </SettingsSection>

        <SettingsSection title="Password" description="Choose a password you have not used before.">
          <PasswordForm />
        </SettingsSection>

        <SettingsSection
          title="Two-step sign-in"
          description="The authenticator app we ask for when you sign in."
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text">Authenticator app</p>
              <p className="mt-1 text-sm text-text-muted">
                {authenticatorSince
                  ? `On since ${authenticatorSince}.`
                  : "Not set up. You will be asked to set it up when you sign in."}
              </p>
            </div>
            <Badge variant={authenticator ? "live" : "neutral"} dot={Boolean(authenticator)}>
              {authenticator ? "On" : "Off"}
            </Badge>
          </div>
        </SettingsSection>

        <SettingsSection title="Appearance" description="Choose how Get-On looks for you.">
          <AppearanceSetting />
        </SettingsSection>

        <SettingsSection
          title="Delete account"
          description="We will help you export your data first."
        >
          <DeleteAccount />
        </SettingsSection>
      </AppCard>
    </AppPage>
  );
}
