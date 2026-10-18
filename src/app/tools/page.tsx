import { PageHeader } from "@/components/section-heading";
import { GuestToolsBanner } from "@/components/tool-access";
import { ToolGrid } from "@/components/tool-grid";
import { TOOLS } from "@/lib/tools-registry";

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <PageHeader
        eyebrow={`${TOOLS.length} tools`}
        title="Tools"
        description="Everything runs in your browser except the IP lookup, which needs a server hop to avoid exposing a third-party API from the client."
      />
      <GuestToolsBanner />
      <div className="mt-12">
        <ToolGrid />
      </div>
    </div>
  );
}
