import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-ink">
      <section className="flex max-w-md flex-col gap-4 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-telemetry">404</p>
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="leading-6 text-ink-muted">The requested route does not exist or is no longer available.</p>
        <Link className="mx-auto rounded-md bg-telemetry px-4 py-2 text-sm font-semibold text-surface" href="/dashboard">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
