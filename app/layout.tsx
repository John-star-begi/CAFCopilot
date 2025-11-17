// app/layout.tsx
import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "CAF Copilot",
  description: "Maintenance AI Copilot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-gray-100 text-gray-900">
      <body className="flex min-h-screen">

        {/* SIDEBAR */}
        <aside className="w-64 bg-white border-r shadow-sm flex flex-col">
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold">CAF Copilot</h1>
          </div>

          <nav className="flex-1 p-4 space-y-2 text-sm">
            <Link
              href="/"
              className="block px-3 py-2 rounded-md hover:bg-gray-100 font-medium"
            >
              📁 All Cases
            </Link>

            <Link
              href="/cases/new"
              className="block px-3 py-2 rounded-md hover:bg-gray-100 font-medium"
            >
              ➕ New Case
            </Link>
          </nav>

          <div className="p-4 border-t text-xs text-gray-500">
            Version 0.1 • Internal Preview
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-10">
          {children}
        </main>
      </body>
    </html>
  );
}
