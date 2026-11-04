import { getCurrentUser } from "@/lib/auth/session";
import { EntryScreen } from "@/components/preview/EntryScreen";
export default async function BrowsePage() {
  return <EntryScreen showLogin={!(await getCurrentUser())} />;
}
