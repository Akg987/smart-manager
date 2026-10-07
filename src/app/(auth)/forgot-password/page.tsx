import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame, DemoForm } from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "Ø¨Ø§Ø²ÛŒØ§Ø¨ÛŒ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±" };

export default function ForgotPasswordPage() {
  return <AuthFrame title="Ø¨Ø§Ø²ÛŒØ§Ø¨ÛŒ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±" heading="Ø¨Ø§Ø²ÛŒØ§Ø¨ÛŒ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±" subheading="Ø´Ù…Ø§Ø±Ù‡ Ù…ÙˆØ¨Ø§ÛŒÙ„ Ø­Ø³Ø§Ø¨ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯. Ø§Ú¯Ø± Ø­Ø³Ø§Ø¨ÛŒ Ø¨Ø§ Ø§ÛŒÙ† Ø´Ù…Ø§Ø±Ù‡ ÙˆØ¬ÙˆØ¯ Ø¯Ø§Ø´ØªÙ‡ Ø¨Ø§Ø´Ø¯ØŒ ÛŒÚ© Ú©Ø¯ ÛŒÚ©Ø¨Ø§Ø±Ù…ØµØ±Ù Ø¨Ø±Ø§ÛŒ Ø¢Ù† Ø§Ø±Ø³Ø§Ù„ Ù…ÛŒâ€ŒØ´ÙˆØ¯." footnote={<>Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø±Ø§ Ø¨Ù‡ Ø®Ø§Ø·Ø± Ø¯Ø§Ø±ÛŒØ¯ØŸ <Link href="/login">Ø¨Ø§Ø²Ú¯Ø´Øª Ø¨Ù‡ ÙˆØ±ÙˆØ¯</Link></>}>
    <DemoForm fields={[{ name: "mobile", label: "Ø´Ù…Ø§Ø±Ù‡ Ù…ÙˆØ¨Ø§ÛŒÙ„", type: "tel", placeholder: "09123456789", required: true }]} submitLabel="Ø§Ø±Ø³Ø§Ù„ Ú©Ø¯ ØªØ£ÛŒÛŒØ¯" endpoint="/api/auth/password-reset/request" redirectTo="/reset-password" />
  </AuthFrame>;
}
