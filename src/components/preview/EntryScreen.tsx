import { LoginPanel } from "@/components/auth/LoginPanel";
import { GuestGroupChooser } from "./GuestGroupChooser";
export function EntryScreen({
  error,
  showLogin = true,
}: {
  error?: string;
  showLogin?: boolean;
}) {
  return showLogin ? (
    <section className="entry-compact" aria-label="Вход в аккаунт">
      <LoginPanel error={error} />
    </section>
  ) : (
    <GuestGroupChooser />
  );
}
