import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Nav } from "@/components/nav";
import type React from "react"; // Added import for React

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ReiletAI",
  description: "Protect against voice phishing threats",
  manifest: "/manifest.json",
  icons: {
    icon: "/web-app-manifest-192x192.png",
    shortcut: "/web-app-manifest-512x512.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Nav />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
