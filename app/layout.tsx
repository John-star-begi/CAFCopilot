import "./globals.css";

export const metadata = {
  title: "CAF Copilot v2",
  description: "Next-generation maintenance triage engine"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
