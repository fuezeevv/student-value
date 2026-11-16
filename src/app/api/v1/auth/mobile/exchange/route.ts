import { NextRequest } from "next/server";
import { handleMobileExchange } from "@/server/adapters/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleMobileExchange(request);
}
