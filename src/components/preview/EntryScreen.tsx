import { LoginPanel } from "@/components/auth/LoginPanel";
import { GuestGroupChooser } from "./GuestGroupChooser";

export function EntryScreen({
  error,
  showLogin = true,
}: {
  error?: string;
  showLogin?: boolean;
}) {
  return (
    <>
      {showLogin && (
        <section aria-label="Вход в аккаунт">
          <LoginPanel error={error} />
          <div className="entry-browse-link text-center my-4">
            <a
              className="text-link text-xs text-[var(--ink-muted)] hover:text-[var(--ink)]"
              href="#groups"
            >
              Или выберите группу из списка ниже ↓
            </a>
          </div>
        </section>
      )}
      <GuestGroupChooser />
    </>
  );
}
