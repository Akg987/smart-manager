import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { routeForUi, WorkspacePage } from "@/app/ui/workspace-pages";
import { WorkspaceChrome } from "@/app/ui/workspace-chrome";
import { staticRouteSegments } from "@/app/ui/route-catalog";

type PageProps = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Route labels and settings tabs depend on request-time path/query params.
export const instant = false;

export function generateStaticParams() {
  return staticRouteSegments().map((segments) => ({ segments }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { segments } = await params;
  const page = routeForUi(segments);
  if (!page)
    return { title: "صفحه پیدا نشد", robots: { index: false, follow: false } };
  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
      locale: "fa_IR",
      type: "website",
    },
  };
}

export default async function WorkspaceRoute({
  params,
  searchParams,
}: PageProps) {
  const [{ segments }, query] = await Promise.all([params, searchParams]);
  const page = routeForUi(segments);
  if (!page) notFound();
  const tab = typeof query.tab === "string" ? query.tab : undefined;
  const view = typeof query.view === "string" ? query.view : undefined;
  return (
    <WorkspaceChrome title={page.title}>
      <Suspense
        fallback={
          <div className="card card-bordered">
            <div className="card-inner">در حال دریافت داده‌ها…</div>
          </div>
        }
      >
        <WorkspacePage page={page} tab={tab} view={view} />
      </Suspense>
    </WorkspaceChrome>
  );
}
