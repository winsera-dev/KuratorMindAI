import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KuratorMind AI — Forensic Insolvency Workspace",
  description:
    "A multi-agent AI workspace for Indonesian Kurators. Upload case data, verify creditor claims, map debts, and generate court-ready reports — all grounded in your evidence.",
  icons: {
    icon: [
      { url: "/brand/logo-icon.svg?v=5", type: "image/svg+xml" },
    ],
    shortcut: "/brand/logo-icon.svg?v=5",
    apple: "/brand/logo-icon.svg?v=5",
  },
  keywords: [
    "kurator",
    "insolvency",
    "bankruptcy",
    "Indonesia",
    "AI",
    "forensic",
    "debt verification",
    "UU Kepailitan",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-primary text-text-primary antialiased">
        <Toaster position="bottom-right" theme="dark" />
        {children}
      </body>
    </html>
  );
}
