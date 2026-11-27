import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { TradeError } from "@/lib/errors";
import { apiError } from "@/lib/http";
import { sellShares } from "@/lib/market-service";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new TradeError("Sign in required", 401);
    const { slug } = await context.params;
    const body = (await request.json()) as { shares?: number; outcome?: "YES" | "NO"; answerId?: string };
    const result = await sellShares(user.id, slug, {
      shares: Number(body.shares),
      outcome: body.outcome,
      answerId: body.answerId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
