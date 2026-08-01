// Addressable placeholder for routes whose rich surface is built in a later phase.
// Keeps the router complete (every design §F.2 route resolves) without pre-empting later tasks.
export function PhaseScreen({ title, note }: { title: string; note: string }) {
  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>{title}</h1>
      <p>{note}</p>
    </section>
  );
}
