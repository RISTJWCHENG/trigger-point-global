import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { TradeError } from "@/lib/errors";
import { apiError } from "@/lib/http";
import { cancelLimitOrderById } from "@/lib/market-service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new TradeError("Sign in required", 401);
    const { id } = await context.params;
    const result = await cancelLimitOrderById(user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
