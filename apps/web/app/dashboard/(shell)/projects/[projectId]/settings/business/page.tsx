import { AppCard } from "@/components/app/card";
import { Input, Label } from "@/components/ui/input";

type Params = { params: Promise<{ projectId: string }> };

export default async function BusinessSettingsPage({ params }: Params) {
  const { projectId } = await params;
  return (
    <div>
      <header className="mb-6">
        <div className="text-sm text-text-muted">
          <a className="text-primary hover:underline" href={`/dashboard/projects/${projectId}/settings`}>
            Settings
          </a>
          {" / "}
          <span>Business</span>
        </div>
        <h1 className="mt-2 font-heading text-[22px] font-bold text-text">Business</h1>
        <p className="mt-1 text-[15px] text-text-muted">Your business name, contact details and how it appears.</p>
        <div className="mt-3 inline-flex h-7 items-center rounded-full bg-success-soft px-2.5 text-xs font-semibold text-success">
          Applies when you publish
        </div>
      </header>
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="business-name">Business name</Label>
            <Input id="business-name" placeholder="Your business name" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" placeholder="A short line about what you do" maxLength={120} />
            <p className="text-sm text-text-muted">Used in search results and when your link is shared.</p>
          </div>
        </div>
      </AppCard>
    </div>
  );
}
