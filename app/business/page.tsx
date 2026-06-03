import { LogoutButton } from "@/components/logout-button";

export default function BusinessPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">Ruxstar Business</span>
        <LogoutButton />
      </header>
      <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6">
        <p className="text-sm text-white/50">Business dashboard — coming soon</p>
      </main>
    </div>
  );
}
