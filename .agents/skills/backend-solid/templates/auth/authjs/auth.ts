// auth.ts  (Auth.js v5, install with: npm i next-auth@beta)
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    // With the default JWT sessions the user id is in token.sub. Copy it so the app can read session.user.id.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})
