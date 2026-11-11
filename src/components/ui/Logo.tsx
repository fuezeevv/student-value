import Link from "next/link";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 29C4 16 17 4 31 7C43 10 42 20 31 23C21 26 15 22 12 32C10 38 6 36 5 29Z"
        fill="#3378ff"
      />
      <path
        d="M12 34C14 23 25 29 34 20C41 13 46 23 40 33C35 42 20 46 12 39C10 37 11 36 12 34Z"
        fill="#dcecff"
      />
      <path
        d="M32 30C38 28 43 30 40 35C38 40 31 43 25 42C21 41 27 32 32 30Z"
        fill="#9b304d"
      />
    </svg>
  );
}

export function Logo({
  className = "",
  showSubtitle = false,
}: {
  className?: string;
  showSubtitle?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`brand ${className}`}
      aria-label="Student Value 1.984 — сегодня"
    >
      <BrandMark className="h-9 w-9 shrink-0" />
      <span className="brand-type hidden sm:inline">
        Student Value <span className="brand-coefficient">1.984</span>
        {showSubtitle && <span className="brand-caption">место для учёбы</span>}
      </span>
    </Link>
  );
}
