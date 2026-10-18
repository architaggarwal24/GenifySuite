import type { HistoryItem } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/section-heading";
import { ActivityChart } from "@/components/activity-chart";
import { activitySince, buildActivityWindow, utcDayStart } from "@/lib/activity";
import { DashboardQuickLinks } from "@/components/dashboard-quick-links";
import { HistoryList, type HistoryItemDTO } from "@/components/history-list";
import { HistorySearch } from "@/components/history-search";
import { StatCard } from "@/components/stat-card";
import { ToolUsageBars } from "@/components/tool-usage-bars";
import { authOptions } from "@/lib/auth";
import { getPlan } from "@/lib/billing";
import { checkUsage } from "@/lib/ai/usage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ACTIVITY_DAYS = 14;

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");
  const userId = session.user.id;

  const now = new Date();
  const todayStart = utcDayStart(now);
  const since = activitySince(now, ACTIVITY_DAYS);

  const [items, totalSaved, savedToday, recentDates, topTools, apiKeyCount, workflowCount, subscription] =
    await Promise.all([
      prisma.historyItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.historyItem.count({ where: { userId } }),
      prisma.historyItem.count({ where: { userId, createdAt: { gte: todayStart } } }),
      prisma.historyItem.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.historyItem.groupBy({
        by: ["tool"],
        where: { userId },
        _count: { _all: true },
        orderBy: { _count: { tool: "desc" } },
        take: 5,
      }),
      prisma.apiKey.count({ where: { userId } }),
      prisma.workflow.count({ where: { userId } }),
      prisma.subscription.findUnique({ where: { userId } }),
    ]);

  const dto: HistoryItemDTO[] = items.map((item: HistoryItem) => ({
    id: item.id,
    tool: item.tool,
    label: item.label,
    createdAt: item.createdAt.toISOString(),
  }));

  const activityDays = buildActivityWindow(
    now,
    (recentDates as { createdAt: Date }[]).map((r) => r.createdAt),
    ACTIVITY_DAYS
  ).map(({ date, count }) => ({
    label: new Date(date).toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" }),
    count,
  }));

  const tier = subscription?.tier ?? "FREE";
  const plan = getPlan(tier);
  const [sharedUsage, byokUsage] = await Promise.all([
    checkUsage(userId, true, tier),
    checkUsage(userId, false, tier),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <PageHeader
        eyebrow={`${plan.name} plan`}
        title="Dashboard"
        description={`Signed in as ${session.user.email ?? session.user.name}.`}
      />

      <div className="mt-8">
        <DashboardQuickLinks />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Saved total" value={totalSaved} sub={savedToday > 0 ? `${savedToday} today` : undefined} />
        <StatCard
          label="Shared key today"
          value={`${sharedUsage.limit - sharedUsage.remaining}/${sharedUsage.limit}`}
          sub={`${plan.name} plan`}
        />
        <StatCard label="BYOK today" value={`${byokUsage.limit - byokUsage.remaining}/${byokUsage.limit}`} />
        <StatCard label="Keys · workflows" value={`${apiKeyCount} · ${workflowCount}`} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-ink-line bg-ink-raised/70 p-5 shadow-card backdrop-blur-sm lg:col-span-2">
          <h2 className="mb-5 font-display text-sm font-semibold text-paper">Last {ACTIVITY_DAYS} days</h2>
          <ActivityChart days={activityDays} />
        </div>
        <div className="rounded-2xl border border-ink-line bg-ink-raised/70 p-5 shadow-card backdrop-blur-sm">
          <h2 className="mb-5 font-display text-sm font-semibold text-paper">Most used tools</h2>
          <ToolUsageBars
            items={topTools.map((t: { tool: string; _count: { _all: number } }) => ({ tool: t.tool, count: t._count._all }))}
          />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-display text-xl font-semibold tracking-tight text-paper">Recent history</h2>
        <HistorySearch />
        <HistoryList initialItems={dto} />
      </div>
    </div>
  );
}
