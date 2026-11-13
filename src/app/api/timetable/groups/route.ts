import { NextResponse } from "next/server";
import { publicGroups } from "@/lib/groups/public-groups";
export async function GET() {
  if (process.env.SV_TEST_ISOLATED === "1")
    return NextResponse.json(
      publicGroups.map((g) => ({ id: g.ruzId, name: g.code })),
    );
  try {
    const r = await fetch(
      "https://ruz.spbstu.ru/api/v1/ruz/faculties/125/groups",
      {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(6000),
        redirect: "error",
      },
    );
    if (!r.ok) throw Error();
    const text = await r.text();
    if (text.length > 512000) throw Error();
    const raw = JSON.parse(text);
    const groups = raw.groups
      .filter(
        (g: { id: number; name: string }) =>
          Number.isSafeInteger(g.id) &&
          typeof g.name === "string" &&
          g.name.length < 100,
      )
      .slice(0, 1500)
      .map((g: { id: number; name: string }) => ({ id: g.id, name: g.name }));
    return NextResponse.json(groups);
  } catch {
    return NextResponse.json(
      publicGroups.map((g) => ({ id: g.ruzId, name: g.code })),
    );
  }
}
