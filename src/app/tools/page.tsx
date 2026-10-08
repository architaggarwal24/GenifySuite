import { ToolGrid } from "@/components/tool-grid";

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <h1 className="text-2xl font-semibold text-paper">Tools</h1>
      <p className="mt-2 max-w-lg text-paper-dim">
        Everything runs in your browser except the IP lookup, which needs a server hop to avoid
        exposing a third-party API from the client.
      </p>
      <div className="mt-10">
        <ToolGrid />
      </div>
    </div>
  );
}
