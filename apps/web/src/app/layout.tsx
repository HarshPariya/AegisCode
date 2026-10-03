import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "AegisCode — Autonomous AI Software Engineering Platform",
  description: "Connect your GitHub repository and let an orchestrated team of specialized AI agents investigate, plan, code, test, review, and open verified pull requests safely.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background flex flex-col antialiased selection:bg-brand-500/20 selection:text-brand-400">
        <Navigation />
        <main className="flex-1 w-full">
          <AuthGuard>{children}</AuthGuard>
        </main>
        <Footer />
      </body>
    </html>
  );
}
