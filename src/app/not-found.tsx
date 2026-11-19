import Link from "next/link";
import { Wordmark } from "@/components/portal/wordmark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-cream-50 px-6 text-center">
      <Wordmark />
      <div>
        <h1 className="font-serif text-[28px] font-semibold">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">It may have moved, or the link may be out of date.</p>
      </div>
      <Button asChild>
        <Link href="/">Back to your overview</Link>
      </Button>
    </main>
  );
}
