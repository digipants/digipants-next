import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { hashToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { token, password, confirmPassword } = await req.json();

  if (
    typeof token !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string" ||
    password.trim().length === 0 ||
    confirmPassword.trim().length === 0
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }

  await connectDB();

  const hashedToken = hashToken(token);

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Token expired or invalid" },
      { status: 400 }
    );
  }

  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  return NextResponse.json({ success: true });
}

