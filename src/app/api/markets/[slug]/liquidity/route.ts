import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { TradeError } from "@/lib/errors";
import { apiError } from "@/lib/http";
import { addLiquidity } from "@/lib/market-service";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new TradeError("Sign in required", 401);
    const { slug } = await context.params;
    const body = (await request.json()) as { amount?: number };
    const result = await addLiquidity(user.id, slug, Number(body.amount));
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
