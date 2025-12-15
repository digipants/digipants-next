import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
  await connectDB();

  if (!credentials?.email || !credentials.password) {
    throw new Error("Missing credentials");
  }

  const user = await User.findOne({ email: credentials.email }).lean();
  if (!user) {
    throw new Error("User not found");
  }

  if (user.provider === "google") {
    throw new Error("Use Google login for this account");
  }

  if (!user.password) {
    throw new Error("Password login not available");
  }

  const isValid = await bcrypt.compare(
    credentials.password,
    user.password
  );

  if (!isValid) {
    throw new Error("Invalid password");
  }

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

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  callbacks: {
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
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
