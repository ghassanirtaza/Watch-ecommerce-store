import { getAllSettings } from "@/domain/settings/service";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function AdminSettingsPage() {
  const settings = await getAllSettings();

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl">Settings</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
