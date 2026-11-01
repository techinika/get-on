import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enter your sign-in code | Get-On",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LegacyLoginVerifyPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const target = safeNextPath(next, "/dashboard");
  redirect(`/mfa?next=${encodeURIComponent(target)}`);
}
