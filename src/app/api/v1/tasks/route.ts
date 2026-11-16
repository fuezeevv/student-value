import { NextRequest } from "next/server";
import { handleGetMobileTasks } from "@/server/adapters/mobile-tasks";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleGetMobileTasks(request);
}
