import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketView } from "@/components/market-view";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMarket } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const market = await prisma.market.findUnique({ where: { slug }, select: { question: true } });
  return { title: market?.question ?? "Market" };
}

export default async function MarketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const market = await getMarket(slug, user?.id);
  if (!market) notFound();
  return (
    <MarketView
      market={market}
      user={
        user
          ? {
              id: user.id,
              username: user.username,
              name: user.name,
              balance: user.balance,
              avatarColor: user.avatarColor,
              unread: user.unread,
            }
          : null
      }
    />
  );
}
