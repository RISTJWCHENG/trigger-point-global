import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { TradeError } from "@/lib/errors";
import { apiError } from "@/lib/http";
import { createMarket } from "@/lib/market-service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new TradeError("Sign in required", 401);
    const body = (await request.json()) as {
      question?: string;
      description?: string;
      type?: "BINARY" | "MULTIPLE" | "POLL";
      topic?: string;
      closeAt?: string;
      ante?: number;
      probability?: number;
      answers?: { text?: string; probability?: number }[];
      creatorBlocked?: boolean;
    };
    const result = await createMarket({
      creatorId: user.id,
      question: body.question ?? "",
      description: body.description ?? "",
      type: body.type === "MULTIPLE" ? "MULTIPLE" : body.type === "POLL" ? "POLL" : "BINARY",
      topic: body.topic ?? "",
      closeAt: new Date(body.closeAt ?? ""),
      ante: Number(body.ante),
      probability: body.probability,
      answers: (body.answers ?? []).map((answer) => ({ text: answer.text ?? "", probability: answer.probability })),
      creatorBlocked: Boolean(body.creatorBlocked),
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
