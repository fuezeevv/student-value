import Link from "next/link";

export function LegalLinks() {
  return (
    <nav
      aria-label="Информация о сервисе"
      className="flex flex-wrap gap-x-5 gap-y-2"
    >
      <Link
        href="/privacy"
        className="underline underline-offset-4 hover:text-blue-200"
      >
        Конфиденциальность
      </Link>
      <Link
        href="/terms"
        className="underline underline-offset-4 hover:text-blue-200"
      >
        Условия использования
      </Link>
    </nav>
  );
}
