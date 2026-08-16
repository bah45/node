"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-ink">
      <section className="flex max-w-md flex-col gap-4 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-critical">Runtime error</p>
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p className="leading-6 text-ink-muted">The page could not be loaded. Try again to rebuild the current route.</p>
        <button className="mx-auto rounded-md bg-telemetry px-4 py-2 text-sm font-semibold text-surface" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}
