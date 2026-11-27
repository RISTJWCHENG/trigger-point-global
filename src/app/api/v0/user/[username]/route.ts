import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toPublicUser } from "@/lib/public-api";

export async function GET(_request: Request, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const [followerCount, followingCount] = await Promise.all([
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
  ]);
  return NextResponse.json(toPublicUser({ ...user, followerCount, followingCount }));
}
