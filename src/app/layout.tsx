import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "VENOM SERVICES — منصة الخدمات المتعددة",
  description:
    "منصة فينوم للخدمات المتعددة: كشف التسريبات، محرك بحث، تحميل MEGA، استضافة، ودردشة فورية — بأسلوب فينوم السام",
  keywords: ["Venom", "Services", "leak check", "search", "MEGA", "hosting", "chat"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/venom-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/venom-icon.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Venom title font + Rajdhani body font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Nosifer&family=Rajdhani:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
