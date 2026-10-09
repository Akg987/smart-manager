import type { Metadata } from "next";
import { WorkspaceChrome } from "@/app/ui/workspace-chrome";
import { KpiImportClient } from "./ui";

export const metadata: Metadata = {
  title: "واردسازی داده‌های KPI",
  description: "بارگذاری، اعتبارسنجی و ثبت فایل داده‌های KPI",
};

export default function KpiImportPage() {
  return (
    <WorkspaceChrome title="واردسازی داده‌های KPI">
      <KpiImportClient />
    </WorkspaceChrome>
  );
}
