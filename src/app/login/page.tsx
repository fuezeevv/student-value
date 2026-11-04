import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isDevAuthEnabled } from "@/lib/auth/dev-policy";
import { EntryScreen } from "@/components/preview/EntryScreen";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user && !isDevAuthEnabled()) redirect("/");
  return <EntryScreen error={(await searchParams).error} />;
}
