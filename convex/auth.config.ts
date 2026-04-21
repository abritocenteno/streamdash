// SETUP: After creating your Clerk app, set CLERK_JWT_ISSUER_DOMAIN in
// the Convex dashboard (or via `npx convex env set CLERK_JWT_ISSUER_DOMAIN <value>`)
// then uncomment the providers block below.
//
// Clerk JWT issuer domain format: https://<subdomain>.clerk.accounts.dev

const clerkDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;

export default {
  providers: clerkDomain
    ? [
        {
          domain: clerkDomain,
          applicationID: "convex",
        },
      ]
    : [],
};
