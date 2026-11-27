import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-medium">That page is not on the desk</h1>
      <p className="mt-2 text-sm text-secondary">The market may have been renamed, or the link is off.</p>
      <Link href="/?fy=0" className="btn-primary mt-5">
        Back to markets
      </Link>
    </div>
  );
}
