import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import {
  AuthServiceError,
  getMyProfile,
  signIn,
  signOut,
  signUp,
  type MyProfile,
} from "../services/auth";

type AuthContextValue = {
  session: Session | null;
  profile: MyProfile | null;
  loading: boolean;
  error: AuthServiceError | null;
  signIn: typeof signIn;
  signUp: typeof signUp;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<MyProfile | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<AuthServiceError | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError(new AuthServiceError("auth.errors.supabaseNotConfigured"));
      setSessionLoading(false);
      return;
    }

    let authStateChanged = false;
    let mounted = true;

    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((_event, nextSession) => {
      authStateChanged = true;
      setSession(nextSession);
      setProfileLoading(Boolean(nextSession));
      setSessionLoading(false);
      setError(null);
    });

    void getSupabaseClient()
      .auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!mounted || authStateChanged) {
          return;
        }

        if (sessionError) {
          setError(
            new AuthServiceError("auth.errors.generic", { cause: sessionError }),
          );
        }

        setSession(data.session);
        setProfileLoading(Boolean(data.session));
        setSessionLoading(false);
      })
      .catch((cause: unknown) => {
        if (!mounted || authStateChanged) {
          return;
        }

        setError(
          new AuthServiceError("auth.errors.generic", {
            cause: cause instanceof Error ? cause : undefined,
          }),
        );
        setSessionLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!session) {
      setProfile(null);
      setProfileLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setProfile(null);
    setProfileLoading(true);
    setError(null);

    void getMyProfile(session.user.id)
      .then((nextProfile) => {
        if (!cancelled) {
          setProfile(nextProfile);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof AuthServiceError
              ? cause
              : new AuthServiceError("auth.errors.profileUnavailable", {
                  cause: cause instanceof Error ? cause : undefined,
                }),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProfileLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setSession(null);
    setProfile(null);
    setError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) {
      setProfile(null);
      return null;
    }

    setProfileLoading(true);
    setError(null);

    try {
      const nextProfile = await getMyProfile(session.user.id);
      setProfile(nextProfile);
      return nextProfile;
    } catch (cause) {
      if (cause instanceof AuthServiceError) {
        throw cause;
      }
      throw new AuthServiceError("auth.errors.profileUnavailable", {
        cause: cause instanceof Error ? cause : undefined,
      });
    } finally {
      setProfileLoading(false);
    }
  }, [session]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading: sessionLoading || profileLoading,
      error,
      signIn,
      signUp,
      signOut: handleSignOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      sessionLoading,
      profileLoading,
      error,
      handleSignOut,
      refreshProfile,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
