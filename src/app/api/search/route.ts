import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ markets: [], users: [] });
  const [markets, users] = await Promise.all([
    prisma.market.findMany({
      where: { question: { contains: q } },
      orderBy: { volume: "desc" },
      take: 6,
      select: { slug: true, question: true, probability: true, topic: true },
    }),
    prisma.user.findMany({
      where: { OR: [{ username: { contains: q } }, { name: { contains: q } }] },
      take: 5,
      select: { username: true, name: true, avatarColor: true },
    }),
  ]);
  return NextResponse.json({ markets, users });
}
