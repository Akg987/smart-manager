import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame, DemoForm } from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "ÙˆØ±ÙˆØ¯", description: "ÙˆØ±ÙˆØ¯ Ø¨Ù‡ Ø³Ø§Ù…Ø§Ù†Ù‡ Ø§Ø³Ù…Ø§Ø±Øª Ù…Ù†ÛŒØ¬Ø±" };

export default function LoginPage() {
  return <AuthFrame title="ÙˆØ±ÙˆØ¯" heading="ÙˆØ±ÙˆØ¯ Ø¨Ù‡ Ø³Ø§Ù…Ø§Ù†Ù‡" subheading="Ø¨Ø§ Ø´Ù…Ø§Ø±Ù‡ Ù…ÙˆØ¨Ø§ÛŒÙ„ Ùˆ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø®ÙˆØ¯ ÙˆØ§Ø±Ø¯ Ø´ÙˆÛŒØ¯.">
    <DemoForm fields={[
      { name: "mobile", label: "Ø´Ù…Ø§Ø±Ù‡ Ù…ÙˆØ¨Ø§ÛŒÙ„", type: "tel", placeholder: "09123456789", required: true },
      { name: "password", label: "Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±", type: "password", placeholder: "Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø®ÙˆØ¯ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯", required: true },
      { name: "remember", label: "", type: "checkbox", placeholder: "Ù…Ø±Ø§ Ø¨Ù‡ Ø®Ø§Ø·Ø± Ø¨Ø³Ù¾Ø§Ø±" },
    ]} submitLabel="ÙˆØ±ÙˆØ¯" endpoint="/api/auth/login" redirectTo="/dashboard" />
    <div className="form-note-s2 text-center pt-2"><Link href="/forgot-password">Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø±Ø§ ÙØ±Ø§Ù…ÙˆØ´ Ú©Ø±Ø¯Ù‡â€ŒØ§ÛŒØ¯ØŸ</Link></div>
    <div className="form-note-s2 text-center pt-2">Ø­Ø³Ø§Ø¨ Ú©Ø§Ø±Ø¨Ø±ÛŒ Ù†Ø¯Ø§Ø±ÛŒØ¯ØŸ <Link href="/register">Ø«Ø¨Øªâ€ŒÙ†Ø§Ù… Ú©Ù†ÛŒØ¯</Link></div>
  </AuthFrame>;
}
