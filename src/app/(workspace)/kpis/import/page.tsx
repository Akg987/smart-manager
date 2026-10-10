import type { Metadata } from "next";
import { WorkspaceChrome } from "@/app/ui/workspace-chrome";
import { KpiImportClient } from "./ui";

export const metadata: Metadata = {
  title: "واردسازی داده‌های شاخص عملکرد",
  description: "بارگذاری، اعتبارسنجی و ثبت فایل داده‌های شاخص عملکرد",
};

export default function KpiImportPage() {
  return (
    <WorkspaceChrome title="واردسازی داده‌های شاخص عملکرد">
      <KpiImportClient />
    </WorkspaceChrome>
  );
}
