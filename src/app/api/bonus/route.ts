import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { TradeError } from "@/lib/errors";
import { apiError } from "@/lib/http";
import { claimDailyBonus } from "@/lib/market-service";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new TradeError("Sign in required", 401);
    const result = await claimDailyBonus(user.id);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}