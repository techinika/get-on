import { redirect } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { AppCard } from "@/components/app/card";
import { SettingsSection } from "@/components/app/settings-section";
import { PasswordForm, ProfileForm } from "@/components/app/account-forms";
import { AppearanceSetting } from "@/components/app/appearance-setting";
import { DeleteAccount } from "@/components/app/delete-account";
import { getShellData } from "@/lib/dashboard";

export default async function AccountPage() {
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

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

        <SettingsSection title="Password" description="Choose a password you have not used before.">
          <PasswordForm />
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
