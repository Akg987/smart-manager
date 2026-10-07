import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceChrome } from "@/app/ui/workspace-chrome";
import { routeForUi, WorkspacePage } from "@/app/ui/workspace-pages";

export const metadata: Metadata = {
  title: "نمای کلی سازمان",
  description: "به‌روزرسانی وضعیت بر اساس آخرین ثبت‌های تیم.",
};

export default function HomePage() {
  const page = routeForUi([])!;
  return (
    <WorkspaceChrome title={page.title}>
      <Suspense
        fallback={
          <div className="card card-bordered">
            <div className="card-inner">در حال دریافت داده‌ها…</div>
          </div>
        }
      >
        <WorkspacePage page={page} />
      </Suspense>
    </WorkspaceChrome>
  );
}
