import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { TradeError } from "@/lib/errors";
import { apiError } from "@/lib/http";
import { settleMarket } from "@/lib/market-service";
import type { ResolveInput } from "@/lib/ledger";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new TradeError("Sign in required", 401);
    const { slug } = await context.params;
    const body = (await request.json()) as {
      resolution?: string;
      probability?: number;
      answerId?: string;
      weights?: Record<string, number>;
      note?: string;
    };
    let input: ResolveInput;
    if (body.resolution === "YES" || body.resolution === "NO" || body.resolution === "CANCEL") {
      input = { resolution: body.resolution, note: body.note };
    } else if (body.resolution === "MKT") {
      input = { resolution: "MKT", probability: Number(body.probability), note: body.note };
    } else if (body.resolution === "MKT_MULTI") {
      input = { resolution: "MKT_MULTI", weights: body.weights ?? {}, note: body.note };
    } else if (body.resolution === "ANSWER" && body.answerId) {
      input = { resolution: "ANSWER", answerId: body.answerId, note: body.note };
    } else {
      throw new TradeError("Choose how this market resolves");
    }
    const result = await settleMarket(user.id, slug, input, body.note ?? "");
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
