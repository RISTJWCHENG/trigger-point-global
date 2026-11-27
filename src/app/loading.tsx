export default function Loading() {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-6">
      <div className="h-8 w-40 rounded-lg bg-pill" />
      <div className="mt-3 h-11 rounded-lg bg-card border border-line" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 rounded-2xl border border-line bg-card" />
        ))}
      </div>
    </div>
  );
}
