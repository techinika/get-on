import { Compass } from "lucide-react";
import Link from "next/link";
import { AppPage } from "@/components/app/app-page";

export default function DashboardNotFound() {
  return (
    <AppPage width="narrow">
      <div className="mx-auto flex max-w-[520px] flex-col items-center py-16 text-center">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-text"
        >
          <Compass size={24} strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 text-h3 text-text">We could not find that page</h1>
        <p className="mt-2 text-[15px] text-text-muted">
          The page may have been removed, or the link may be out of date.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-input bg-primary px-5 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover"
        >
          Back to my websites
        </Link>
      </div>
    </AppPage>
  );
}
