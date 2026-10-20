import { Info } from "lucide-react";

export default function SettingsPlaceholderPage() {
  return (
    <div>
      <h1 className="text-h1">Settings</h1>
      <div className="mt-4 flex gap-3 rounded-info bg-info-soft px-4 py-3.5 text-sm text-info-text">
        <Info size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
        <p>Settings are coming soon. For now you can update your details when the editor arrives.</p>
      </div>
    </div>
  );
}
