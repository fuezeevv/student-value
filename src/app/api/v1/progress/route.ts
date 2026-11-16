import { NextRequest } from "next/server";
import {
  handleMobileProgress,
  handleGetMobileProgress,
} from "@/server/adapters/mobile-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleMobileProgress(request);
}

export async function GET(request: NextRequest) {
  return handleGetMobileProgress(request);
}
