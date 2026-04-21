/**
 * Bridges Clerk's session token to Convex's auth system.
 * Call this hook once at the top of ConvexProviderWithClerk or
 * wherever you need to inject the JWT.
 */
import { useAuth } from "@clerk/clerk-expo";
import { useConvexAuth } from "convex/react";

export function useClerkConvexAuth() {
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();

  return {
    isReady: clerkLoaded && !convexLoading,
    isAuthenticated: isSignedIn && isAuthenticated,
  };
}
