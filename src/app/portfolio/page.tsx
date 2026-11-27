import Link from "next/link";
import { PortfolioView } from "@/components/portfolio-view";
import { getCurrentUser } from "@/lib/auth";
import { getPortfolio } from "@/lib/queries";

export const metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-medium">Portfolio</h1>
        <p className="mt-2 text-sm text-secondary">Sign in to see your cash, positions, and profit.</p>
        <Link href="/signin?next=/portfolio" className="btn-primary mt-5">
          Sign in
        </Link>
      </div>
    );
  }
  const data = await getPortfolio(user.id, user.id);
  if (!data) return null;
  return <PortfolioView data={data} />;
}
