import { SignUpForm } from "@/components/auth-form";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-medium tracking-tight">Create an account</h1>
      <p className="mb-5 mt-1 text-sm text-secondary">A fresh desk starts with 1,000 TP.</p>
      <SignUpForm />
    </div>
  );
}
