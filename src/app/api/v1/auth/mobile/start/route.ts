import { NextRequest } from "next/server";
import { handleMobileAuthStart } from "@/server/adapters/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleMobileAuthStart(request);
}
