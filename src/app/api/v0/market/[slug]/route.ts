import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toPublicMarket } from "@/lib/public-api";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const market = await prisma.market.findUnique({
    where: { slug },
    include: {
      answers: { orderBy: { sortIndex: "asc" } },
      trades: { orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { username: true } } } },
    },
  });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
  return NextResponse.json(toPublicMarket(market, true));
}
