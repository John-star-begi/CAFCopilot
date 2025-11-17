// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "CAF Copilot",
  description: "AI-powered maintenance triage assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden md:flex w-64 flex-col border-r bg-white shadow-sm">
            <div className="p-6 border-b">
              <h1 className="text-xl font-bold tracking-tight">CAF Copilot</h1>
              <p className="text-xs text-slate-500">Maintenance Intelligence</p>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              <a
                href="/"
                className="block px-3 py-2 rounded-md text-sm hover:bg-slate-100"
              >
                Cases
              </a>

              <a
                href="/cases/new"
                className="block px-3 py-2 rounded-md text-sm hover:bg-slate-100"
              >
                + New Case
              </a>
            </nav>

            <div className="p-4 border-t text-xs text-slate-400">
              Version 0.1.0
            </div>
          </aside>

          {/* Main workspace content */}
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
