import { requireCurrentUser } from "@/lib/auth/session";
import { UniversityClient } from "./UniversityClient";

export const dynamic = "force-dynamic";
export default async function UniversityPage() {
  const user = await requireCurrentUser();
  return <UniversityClient key={user.id} userId={user.id} />;
}
