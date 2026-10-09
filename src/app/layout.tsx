import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "اسمارت منیجر | مدیریت هوشمند سازمان",
    template: "%s | اسمارت منیجر",
  },
  description: "هسته مدیریت هوشمند اسمارت منیجر",
  applicationName: "Smart Manager",
  icons: {
    icon: "/images/favicon.png",
    apple: "/images/favicon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className="min-h-full" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/assets/css/dashlite.rtl.css" />
        <link rel="stylesheet" href="/assets/css/theme.css?v=smart-25" />
      </head>
      <body className="min-h-full bg-brand-canvas font-sans text-brand-ink antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
