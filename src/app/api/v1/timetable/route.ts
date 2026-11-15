import { NextRequest } from "next/server";
import { handleTimetableRequest } from "@/server/adapters/timetable-v1";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleTimetableRequest(request);
}
