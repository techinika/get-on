import { AppCard } from "@/components/app/card";

type Params = { params: Promise<{ token: string }> };

export default async function TransferPage({ params }: Params) {
  const { token } = await params;
  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] items-center px-4 py-12">
      <AppCard className="w-full p-8">
        <h1 className="font-heading text-[28px] font-bold text-text">Transfer request</h1>
        <p className="mt-2 text-[15px] text-text-muted">This transfer request is not available.</p>
      </AppCard>
    </main>
  );
}
