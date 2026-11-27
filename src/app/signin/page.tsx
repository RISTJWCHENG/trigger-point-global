import { SignInForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
      <p className="mb-5 mt-1 text-sm text-secondary">The demo desk is the fastest way to place a trade.</p>
      <SignInForm next={next} />
    </div>
  );
}
