import type { SupabaseClient } from "@supabase/supabase-js";
import env from "@/lib/env";

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl.trim() && env.supabaseAnonKey.trim());
}

export function isAdminSupabaseConfigured(): boolean {
  return Boolean(
    env.supabaseUrl.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

type QueryResult<T = unknown> = {
  data: T;
  error: null;
  count: number | null;
  status: number;
  statusText: string;
};

function makeQueryBuilder(isSingle = false): unknown {
  const result: QueryResult = {
    data: isSingle ? null : [],
    error: null,
    count: isSingle ? null : 0,
    status: 200,
    statusText: "OK",
  };

  const proxy: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (
            onFulfilled?: (value: QueryResult) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => Promise.resolve(result).then(onFulfilled, onRejected);
        }
        if (prop === "catch") {
          return (onRejected?: (reason: unknown) => unknown) =>
            Promise.resolve(result).catch(onRejected);
        }
        if (prop === "finally") {
          return (onFinally?: () => void) =>
            Promise.resolve(result).finally(onFinally);
        }
        if (prop === "maybeSingle" || prop === "single") {
          return () => makeQueryBuilder(true);
        }
        return () => proxy;
      },
    },
  );

  return proxy;
}

export function createMockSupabaseClient(): SupabaseClient {
  const unconfiguredError = {
    message: "SUPABASE_NOT_CONFIGURED",
    code: "SUPABASE_NOT_CONFIGURED",
    details: "",
    hint: "",
  };

  const mock = {
    auth: {
      async getUser() {
        return { data: { user: null }, error: null };
      },
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async signOut() {
        return { error: null };
      },
      async exchangeCodeForSession() {
        return { data: { user: null, session: null }, error: unconfiguredError };
      },
      async resend() {
        return { data: { user: null, session: null }, error: null };
      },
      async signInWithPassword() {
        return { data: { user: null, session: null }, error: unconfiguredError };
      },
      async signInWithOtp() {
        return { data: { user: null, session: null }, error: unconfiguredError };
      },
      async verifyOtp() {
        return { data: { user: null, session: null }, error: unconfiguredError };
      },
      async updateUser() {
        return { data: { user: null }, error: unconfiguredError };
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              id: "mock",
              callback: () => undefined,
              unsubscribe: () => undefined,
            },
          },
        };
      },
      mfa: {
        async getAuthenticatorAssuranceLevel() {
          return {
            data: {
              currentLevel: null,
              nextLevel: null,
              currentAuthenticationMethods: [],
            },
            error: null,
          };
        },
        async listFactors() {
          return { data: { all: [], totp: [], phone: [] }, error: null };
        },
        async enroll() {
          return { data: null, error: unconfiguredError };
        },
        async challenge() {
          return { data: null, error: unconfiguredError };
        },
        async verify() {
          return { data: null, error: unconfiguredError };
        },
        async unenroll() {
          return { data: null, error: unconfiguredError };
        },
      },
      admin: {
        async getUserById() {
          return { data: { user: null }, error: null };
        },
        async listUsers() {
          return { data: { users: [], aud: "" }, error: null };
        },
        async createUser() {
          return { data: { user: null }, error: unconfiguredError };
        },
        async deleteUser() {
          return { data: { user: null }, error: null };
        },
      },
    },
    from() {
      return makeQueryBuilder(false);
    },
    async rpc() {
      return { data: null, error: null, count: null, status: 200, statusText: "OK" };
    },
    storage: {
      from() {
        return {
          async upload() {
            return { data: null, error: unconfiguredError };
          },
          async remove() {
            return { data: [], error: null };
          },
          async createSignedUrl() {
            return { data: null, error: unconfiguredError };
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: path } };
          },
        };
      },
    },
  };

  return mock as unknown as SupabaseClient;
}
