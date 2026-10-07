import { BodyClass } from "@/components/body-class";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <BodyClass className="has-rtl nk-body npc-general pg-auth min-h-full" />
      <main className="min-h-screen">{children}</main>
    </>
  );
}
