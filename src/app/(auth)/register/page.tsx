import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame, DemoForm } from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "Ø«Ø¨Øª Ù†Ø§Ù…", description: "Ø³Ø§Ø®Øª Ø­Ø³Ø§Ø¨ Ú©Ø§Ø±Ø¨Ø±ÛŒ Ø¯Ø± Ø§Ø³Ù…Ø§Ø±Øª Ù…Ù†ÛŒØ¬Ø±" };

export default function RegisterPage() {
  return <AuthFrame title="Ø«Ø¨Øª Ù†Ø§Ù…" heading="Ø«Ø¨Øª Ù†Ø§Ù…" subheading="Ø¨Ø±Ø§ÛŒ Ø³Ø§Ø®Øª Ø­Ø³Ø§Ø¨ Ú©Ø§Ø±Ø¨Ø±ÛŒØŒ Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ø²ÛŒØ± Ø±Ø§ ØªÚ©Ù…ÛŒÙ„ Ú©Ù†ÛŒØ¯.">
    <DemoForm fields={[
      { name: "first_name", label: "Ù†Ø§Ù…", placeholder: "Ù†Ø§Ù… Ø®ÙˆØ¯ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯", required: true },
      { name: "last_name", label: "Ù†Ø§Ù… Ø®Ø§Ù†ÙˆØ§Ø¯Ú¯ÛŒ", placeholder: "Ù†Ø§Ù… Ø®Ø§Ù†ÙˆØ§Ø¯Ú¯ÛŒ Ø®ÙˆØ¯ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯", required: true },
      { name: "birth_date", label: "ØªØ§Ø±ÛŒØ® ØªÙˆÙ„Ø¯", type: "date", placeholder: "Û±Û´Û°Ûµ/Û°Û±/Û°Û±", required: true },
      { name: "national_code", label: "Ú©Ø¯ Ù…Ù„ÛŒ", placeholder: "Û°Û±Û²Û³Û´ÛµÛ¶Û·Û¸Û¹", required: true },
      { name: "address", label: "Ø¢Ø¯Ø±Ø³", type: "textarea", placeholder: "Ù†Ø´Ø§Ù†ÛŒ Ú©Ø§Ù…Ù„ Ù…Ø­Ù„ Ø³Ú©ÙˆÙ†Øª", required: true, full: true },
      { name: "mobile", label: "Ø´Ù…Ø§Ø±Ù‡ Ù…ÙˆØ¨Ø§ÛŒÙ„", type: "tel", placeholder: "09123456789", hint: "Ø§ÛŒÙ† Ø´Ù…Ø§Ø±Ù‡ØŒ Ù†Ø§Ù… Ú©Ø§Ø±Ø¨Ø±ÛŒ Ø´Ù…Ø§ Ø¨Ø±Ø§ÛŒ ÙˆØ±ÙˆØ¯ Ø®ÙˆØ§Ù‡Ø¯ Ø¨ÙˆØ¯.", required: true, full: true },
      { name: "password", label: "Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±", type: "password", placeholder: "Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø®ÙˆØ¯ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯", hint: "Ø­Ø¯Ø§Ù‚Ù„ Û¸ Ú©Ø§Ø±Ø§Ú©ØªØ±ØŒ Ø´Ø§Ù…Ù„ Ø­Ø±Ù Ùˆ Ø¹Ø¯Ø¯.", required: true },
      { name: "password_confirmation", label: "ØªÚ©Ø±Ø§Ø± Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±", type: "password", placeholder: "Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø±Ø§ Ø¯ÙˆØ¨Ø§Ø±Ù‡ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯", required: true },
    ]} submitLabel="Ø«Ø¨Øª Ù†Ø§Ù…" endpoint="/api/auth/register" redirectTo="/approval-pending" />
    <div className="form-note-s2 text-center pt-2">Ø­Ø³Ø§Ø¨ Ú©Ø§Ø±Ø¨Ø±ÛŒ Ø¯Ø§Ø±ÛŒØ¯ØŸ <Link href="/login">ÙˆØ§Ø±Ø¯ Ø´ÙˆÛŒØ¯</Link></div>
  </AuthFrame>;
}
