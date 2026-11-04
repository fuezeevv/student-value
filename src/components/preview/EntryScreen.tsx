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
          <div className="entry-browse-link">
            <a className="text-link" href="#groups">
              Или посмотрите расписание и предметы без входа ↓
            </a>
          </div>
        </section>
      )}
      <GuestGroupChooser />
    </>
  );
}
