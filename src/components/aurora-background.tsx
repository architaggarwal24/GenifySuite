/**
 * Fixed, page-wide ambient background: drifting aurora blobs + a faded grid.
 * Pure CSS (no JS, no deps) - inspired by the aurora/gradient backgrounds on
 * reactbits.dev and kokonutui.com. Sits behind everything (-z-10).
 */
export function AuroraBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-grid-fade" />
      <div className="absolute -left-[10%] -top-[20%] h-[55vmax] w-[55vmax] animate-aurora rounded-full bg-brass/20 blur-[120px]" />
      <div
        className="absolute -right-[15%] top-[5%] h-[45vmax] w-[45vmax] animate-aurora rounded-full bg-cyan-glow/10 blur-[120px]"
        style={{ animationDelay: "-8s" }}
      />
      <div
        className="absolute bottom-[-25%] left-[25%] h-[40vmax] w-[40vmax] animate-aurora rounded-full bg-brass-dim/15 blur-[130px]"
        style={{ animationDelay: "-15s" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
    </div>
  );
}
