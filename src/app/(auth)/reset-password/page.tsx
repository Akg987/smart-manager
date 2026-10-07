import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame, DemoForm } from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "ØªÙ†Ø¸ÛŒÙ… Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø¬Ø¯ÛŒØ¯" };

export default function ResetPasswordPage() {
  return <AuthFrame title="ØªÙ†Ø¸ÛŒÙ… Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø¬Ø¯ÛŒØ¯" heading="Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø¬Ø¯ÛŒØ¯" subheading="Ú©Ø¯ Ø§Ø±Ø³Ø§Ù„â€ŒØ´Ø¯Ù‡ Ø¨Ù‡ Ù…ÙˆØ¨Ø§ÛŒÙ„ Ùˆ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± ØªØ§Ø²Ù‡ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯." footnote={<>Ú©Ø¯ Ù†Ø±Ø³ÛŒØ¯ØŸ <Link href="/forgot-password">Ø§Ø±Ø³Ø§Ù„ Ø¯ÙˆØ¨Ø§Ø±Ù‡</Link></>}>
    <DemoForm fields={[
      { name: "mobile", label: "Ø´Ù…Ø§Ø±Ù‡ Ù…ÙˆØ¨Ø§ÛŒÙ„", type: "tel", placeholder: "09123456789", required: true },
      { name: "code", label: "Ú©Ø¯ ØªØ£ÛŒÛŒØ¯", placeholder: "Ú©Ø¯ Ù¾ÛŒØ§Ù…Ú©â€ŒØ´Ø¯Ù‡", required: true },
      { name: "password", label: "Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø¬Ø¯ÛŒØ¯", type: "password", placeholder: "Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± ØªØ§Ø²Ù‡", hint: "Ø­Ø¯Ø§Ù‚Ù„ Û¸ Ú©Ø§Ø±Ø§Ú©ØªØ±ØŒ Ø´Ø§Ù…Ù„ Ø­Ø±Ù Ùˆ Ø¹Ø¯Ø¯.", required: true },
      { name: "password_confirmation", label: "ØªÚ©Ø±Ø§Ø± Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±", type: "password", placeholder: "Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø±Ø§ Ø¯ÙˆØ¨Ø§Ø±Ù‡ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯", required: true },
    ]} submitLabel="Ø°Ø®ÛŒØ±Ù‡ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±" endpoint="/api/auth/password-reset/confirm" redirectTo="/login" />
  </AuthFrame>;
}
