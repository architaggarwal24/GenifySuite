import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AccountSettingsClient } from "@/components/account-settings-client";
import { SettingsTabs } from "@/components/settings-tabs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, emailVerified: true, passwordHash: true, subscription: { select: { status: true, stripeSubscriptionId: true } } },
  });
  if (!user?.email) redirect("/login");

  const sub = user.subscription;
  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="text-2xl font-semibold text-paper">Settings</h1>
      <SettingsTabs />
      <AccountSettingsClient
        email={user.email}
        name={user.name}
        emailVerified={Boolean(user.emailVerified)}
        hasPassword={Boolean(user.passwordHash)}
        hasActiveSubscription={Boolean(sub?.stripeSubscriptionId && sub.status !== "canceled")}
      />
    </div>
  );
}
