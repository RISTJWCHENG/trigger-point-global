import { redirect } from "next/navigation";
import { CreateForm } from "@/components/create-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Create a market" };

export default async function CreatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/create");
  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-medium tracking-tight">Create a market</h1>
      <p className="mt-1 mb-5 text-sm text-secondary">
        You fund the opening pool. Traders buy shares that pay 1 TP if that side is right.
      </p>
      <CreateForm balance={user.balance} />
    </div>
  );
}
