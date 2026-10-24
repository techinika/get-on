import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { ExportImportForm } from "./export-import-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  return (
    <div>
      <SettingsPageHeader
        title="Export and import"
        description="Download your whole website as one file, or bring one back."
        timing="right"
      />
      <ExportImportForm projectId={projectId} />
    </div>
  );
}
