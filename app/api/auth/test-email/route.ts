import { NextResponse } from "next/server";
import { resend } from "@/lib/resend";

export async function GET() {
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: "amankhare.aa@email.com",
    subject: "Resend is working",
    html: "<p>Your Resend setup is working.</p>",
  });

  return NextResponse.json({ success: true });
}
