import type { Metadata } from "next";
import { AuthFrame, DemoForm } from "@/app/ui/auth-form";

export const metadata: Metadata = { title: "Ø±Ø§Ù‡â€ŒØ§Ù†Ø¯Ø§Ø²ÛŒ Ø§ÙˆÙ„ÛŒÙ‡" };

export default function SetupPage() {
  return <AuthFrame title="Ø±Ø§Ù‡â€ŒØ§Ù†Ø¯Ø§Ø²ÛŒ Ø§ÙˆÙ„ÛŒÙ‡" heading="Ø³Ø§Ø®Øª Ø­Ø³Ø§Ø¨ Ù…Ø¯ÛŒØ±" subheading="Ø§ÛŒÙ† Ù†Ø®Ø³ØªÛŒÙ† Ø§Ø¬Ø±Ø§ÛŒ Ø³Ø§Ù…Ø§Ù†Ù‡ Ø§Ø³Øª. Ø´Ù…Ø§Ø±Ù‡ Ù…ÙˆØ¨Ø§ÛŒÙ„ Ùˆ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø®ÙˆØ¯ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯ ØªØ§ Ø­Ø³Ø§Ø¨ Ù…Ø¯ÛŒØ± Ø³Ø§Ø®ØªÙ‡ Ø´ÙˆØ¯.">
    <DemoForm fields={[
      { name: "mobile", label: "Ø´Ù…Ø§Ø±Ù‡ Ù…ÙˆØ¨Ø§ÛŒÙ„", type: "tel", placeholder: "09123456789", hint: "Ø§ÛŒÙ† Ø´Ù…Ø§Ø±Ù‡ØŒ Ù†Ø§Ù… Ú©Ø§Ø±Ø¨Ø±ÛŒ Ø´Ù…Ø§ Ø¨Ø±Ø§ÛŒ ÙˆØ±ÙˆØ¯ Ø®ÙˆØ§Ù‡Ø¯ Ø¨ÙˆØ¯.", required: true },
      { name: "password", label: "Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±", type: "password", placeholder: "Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø®ÙˆØ¯ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯", hint: "Ø­Ø¯Ø§Ù‚Ù„ Û¸ Ú©Ø§Ø±Ø§Ú©ØªØ±ØŒ Ø´Ø§Ù…Ù„ Ø­Ø±Ù Ùˆ Ø¹Ø¯Ø¯.", required: true },
      { name: "password_confirmation", label: "ØªÚ©Ø±Ø§Ø± Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±", type: "password", placeholder: "Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø±Ø§ Ø¯ÙˆØ¨Ø§Ø±Ù‡ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯", required: true },
    ]} submitLabel="Ø³Ø§Ø®Øª Ø­Ø³Ø§Ø¨ Ù…Ø¯ÛŒØ± Ùˆ ÙˆØ±ÙˆØ¯" endpoint="/api/auth/setup" redirectTo="/dashboard" />
  </AuthFrame>;
}
