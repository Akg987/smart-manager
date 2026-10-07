import type { Metadata, Viewport } from "next";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className="h-full antialiased">
      <body className="has-rtl nk-body bg-lighter npc-general has-sidebar min-h-full">
        {children}
      </body>
    </html>
  );
}
