// Placeholder Today screen: shows the design tokens until the plan is wired in.
export default function Home() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <p className="text-muted">Good morning</p>
      <h1 className="mt-1 text-2xl font-semibold">Today</h1>

      <section className="mt-6 rounded-card bg-accent-soft p-6 text-accent-ink">
        <p className="text-sm font-medium uppercase tracking-wide">Easy run</p>
        <p className="mt-2 text-6xl font-semibold">
          7.0 <span className="text-2xl font-medium">km</span>
        </p>
        <p className="mt-2 text-sm">Zone 2, plus strides</p>
      </section>
    </main>
  );
}
