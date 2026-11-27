import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { TradeError } from "@/lib/errors";
import { apiError } from "@/lib/http";
import { sendTip } from "@/lib/market-service";

export async function POST(request: Request, context: { params: Promise<{ username: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new TradeError("Sign in required", 401);
    const { username } = await context.params;
    const body = (await request.json()) as { amount?: number; note?: string };
    const result = await sendTip(user.id, username, Number(body.amount), body.note ?? "");
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
