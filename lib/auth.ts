import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import crypto from "crypto";

export function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  return { rawToken, hashedToken, expires };
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
export const authOptions: NextAuthOptions = {
  providers: [
    // ---------------- GOOGLE ----------------
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ---------------- CREDENTIALS ----------------
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        await connectDB();

        if (!credentials?.email || !credentials.password) return null;

        const user = await User.findOne({ email: credentials.email }).lean();
        if (!user) return null;

        // prevent password login for Google users
        if (user.provider === "google") return null;

        if (!user.password) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isValid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image || null,
        };
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    // -------- SAVE GOOGLE USER TO DB --------
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await connectDB();

        if (!user.email) return false;

        await User.findOneAndUpdate(
          { email: user.email },
          {
            name: user.name ?? "Google User",
            email: user.email,
            image: user.image,
            provider: "google",
          },
          { upsert: true }
        );
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) token.id = (user as any).id;
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
