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
    <html lang="fa" dir="rtl" className="js h-full" suppressHydrationWarning>
      <body className="has-rtl nk-body npc-general min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
