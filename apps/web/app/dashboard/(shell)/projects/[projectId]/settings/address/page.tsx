import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  await params;
  return (
    <div>
      <SettingsPageHeader
        title="Address"
        description="Your web address and sharing options."
        timing="right"
      />
      <AppCard className="max-w-[760px] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold text-text">Your web address</p>
            <p className="mt-1 text-[14px] text-text-muted">Share your website link.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary">Copy</Button>
            <Button type="button" variant="secondary">Share</Button>
            <Button type="button" variant="secondary">QR code</Button>
          </div>
        </div>
      </AppCard>
    </div>
  );
}
