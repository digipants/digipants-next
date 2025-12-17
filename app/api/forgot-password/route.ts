import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { resend } from "@/lib/resend";
import { generateResetToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { email } = await req.json();

  // Always respond the same (security)
  if (!email) {
    return NextResponse.json({ success: true });
  }

  await connectDB();
  const user = await User.findOne({ email });

  if (!user) {
    return NextResponse.json({ success: true });
  }

  const { rawToken, hashedToken, expires } = generateResetToken();

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = expires;
  await user.save();

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${rawToken}`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: user.email,
    subject: "Reset your DigiPants password",
    html: `
      <h2>Password reset</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link expires in 15 minutes.</p>
    `,
  });

  return NextResponse.json({ success: true });
}
