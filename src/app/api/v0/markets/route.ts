import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toPublicMarket } from "@/lib/public-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  const markets = await prisma.market.findMany({
    orderBy: { volume: "desc" },
    take: limit,
    include: { answers: { orderBy: { sortIndex: "asc" } } },
  });
  return NextResponse.json(markets.map((market) => toPublicMarket(market)));
}
