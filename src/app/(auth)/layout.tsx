import { BodyClass } from "@/components/body-class";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <BodyClass className="min-h-full bg-brand-canvas font-sans text-brand-ink" />
      <main className="min-h-screen">{children}</main>
    </>
  );
}
