import { NextResponse } from "next/server";
import { TradeError } from "./errors";

export function apiError(error: unknown) {
  if (error instanceof TradeError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
