import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type MumoUser = {
  id: string;
  email: string | null;
};

export type MumoSession = {
  user: MumoUser;
};

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  credits: number;
};

type AuthMeResponse = {
  user?: MumoUser | null;
  profile?: Profile | null;
};

type AuthCtx = {
  session: MumoSession | null;
  user: MumoUser | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

async function fetchCurrentUser(): Promise<AuthMeResponse> {
  const res = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "include",
    headers: {
      "accept": "application/json",
    },
  });

  if (!res.ok) {
    return { user: null, profile: null };
  }

  return res.json() as Promise<AuthMeResponse>;
}

function normalizeProfile(profile: Profile | null | undefined): Profile | null {
  if (!profile) return null;

  return {
    ...profile,
    credits: Number(profile.credits ?? 0),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MumoSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await fetchCurrentUser();
      const user = data.user ?? null;

      setSession(user ? { user } : null);
      setProfile(normalizeProfile(data.profile));
    } catch {
      setSession(null);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    fetchCurrentUser()
      .then((data) => {
        if (!alive) return;

        const user = data.user ?? null;
        setSession(user ? { user } : null);
        setProfile(normalizeProfile(data.profile));
      })
      .catch(() => {
        if (!alive) return;

        setSession(null);
        setProfile(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setSession(null);
      setProfile(null);
    }
  }, []);

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, profile, loading, refreshProfile, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

const FALLBACK: AuthCtx = {
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
};

export function useAuth() {
  const v = useContext(Ctx);
  return v ?? FALLBACK;
}
