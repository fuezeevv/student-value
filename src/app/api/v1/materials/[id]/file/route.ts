import { NextRequest } from "next/server";
import { handleMobileMaterialFile } from "@/server/adapters/mobile-materials";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleMobileMaterialFile(request, id);
}
