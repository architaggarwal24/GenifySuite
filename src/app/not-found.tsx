import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-28 text-center">
      <p className="text-gradient-animated font-display text-8xl font-semibold tracking-tighter">404</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-paper">Nothing on this shelf.</h1>
      <p className="mt-3 text-paper-dim">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/tools" className="mt-8 inline-block">
        <Button size="lg">
          Browse tools <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
