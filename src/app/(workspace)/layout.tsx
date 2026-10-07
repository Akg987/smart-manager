import { BodyClass } from "@/components/body-class";

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <BodyClass className="has-rtl nk-body bg-lighter npc-general has-sidebar min-h-full" />
      {children}
    </>
  );
}
