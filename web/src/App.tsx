/** App shell. The Today and Run detail screens replace the placeholder in weeks 4 and 5. */
export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-5">
      <header>
        <p className="text-sm text-muted">Cadent</p>
        <h1 className="m-0 text-2xl font-bold">Good morning</h1>
      </header>
      <section className="rounded-card bg-accent-soft p-5 text-accent-ink">
        <p className="m-0 text-sm font-semibold uppercase tracking-wide">Today</p>
        <p className="m-0 mt-2 text-ink">
          Your planned run will appear here once Garmin sync is connected.
        </p>
      </section>
    </main>
  );
}
