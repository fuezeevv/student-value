import { LoginPanel } from "@/components/auth/LoginPanel";
import { GuestGroupChooser } from "./GuestGroupChooser";

export function EntryScreen({
  error,
  showLogin = true,
}: {
  error?: string;
  showLogin?: boolean;
}) {
  if (showLogin) {
    return (
      <section
        aria-label="Вход в аккаунт"
        className="flex items-center justify-center min-h-[calc(100dvh-170px)]"
      >
        <LoginPanel error={error} />
      </section>
    );
  }

  return <GuestGroupChooser />;
}
