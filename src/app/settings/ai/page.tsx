import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AiSettingsClient } from "@/components/ai-settings-client";
import { SettingsTabs } from "@/components/settings-tabs";
import { authOptions } from "@/lib/auth";

export default async function AiSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings/ai");

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="text-2xl font-semibold text-paper">Settings</h1>
      <SettingsTabs />
      <h2 className="text-lg font-medium text-paper">AI provider keys</h2>
      <p className="mt-2 max-w-lg text-paper-dim">
        Bring your own key for any provider, or use GenifySuite's shared key with a small daily
        trial allowance. Keys are encrypted before they're stored and are never shown again after
        you save them.
      </p>
      <div className="mt-8">
        <AiSettingsClient />
      </div>
    </div>
  );
}
