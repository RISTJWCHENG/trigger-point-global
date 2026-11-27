"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-medium">Something went wrong</h1>
      <p className="mt-2 text-sm text-secondary">The desk hit an unexpected error. Try the page again.</p>
      <button type="button" onClick={reset} className="btn-primary mt-5">
        Try again
      </button>
    </div>
  );
}
