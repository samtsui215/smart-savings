import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smart Savings Allocator",
  description: "Assign every dollar of your savings to a purpose.",
};

// Lock the layout to the device width so phones render at 1:1 instead of a
// wide default viewport you'd have to zoom out to see. Zoom stays enabled
// (no maximumScale) — accessibility matters; we fix overflow at the source
// instead of disabling pinch-zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
