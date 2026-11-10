import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { verifyOtp, normalizeEmail } from "@/lib/otp";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          return null;
        }

        // Disabled accounts (e.g. a reseller toggled off in admin) can't sign in.
        if (!user.isActive) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),

    // Passwordless email OTP login for customers. Email is the primary
    // identifier. The code is verified here, in authorize, so it's consumed
    // exactly once. On success we find the customer by email or create a fresh
    // passwordless CUSTOMER account.
    Credentials({
      id: "otp",
      name: "email-otp",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email as string | undefined);
        const code = credentials?.code as string | undefined;
        if (!email || !code) return null;

        const ok = await verifyOtp(email, code);
        if (!ok) return null;

        let user = await db.user.findUnique({ where: { email } });

        if (user) {
          if (!user.isActive) return null;
        } else {
          user = await db.user.create({
            data: {
              email,
              name: (credentials?.name as string)?.trim() || "Customer",
              role: "CUSTOMER",
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});