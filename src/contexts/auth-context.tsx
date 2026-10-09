"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch, parseApiBody } from "@/lib/api";

export type TenantMembership = {
  membershipId: string;
  holdingId: string;
  holdingName: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  roleIds: string[];
};

export type AuthMe = {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    mobile: string;
    role: string;
    departmentId: string | null;
    avatarPath?: string | null;
  };
  authContext: {
    userId: string;
    holdingId: string;
    membershipId: string;
    companyId: string | null;
    branchId: string | null;
    businessUnitId: string | null;
    roleIds: string[];
    scopeType: string;
  };
  memberships: TenantMembership[];
  permissions: string[];
};

type AuthState = {
  data: AuthMe | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<AuthMe | null>;
  switchCompany: (companyId: string) => Promise<void>;
  can: (permission: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

async function getAuthMe(): Promise<AuthMe | null> {
  const response = await apiFetch("/api/auth/me", {
    credentials: "same-origin",
    headers: { accept: "application/json", "accept-language": "fa" },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const parsed = parseApiBody<AuthMe>(await response.json().catch(() => null));
  return parsed.payload ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [data, setData] = useState<AuthMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const current = await getAuthMe();
      setData(current);
      return current;
    } catch {
      setError("دریافت اطلاعات حساب کاربری انجام نشد.");
      setData(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchCompany = useCallback(
    async (companyId: string) => {
      const response = await apiFetch("/api/auth/switch-company", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "accept-language": "fa",
        },
        body: JSON.stringify({ companyId }),
      });
      const parsed = parseApiBody<{ companyId: string }>(
        await response.json().catch(() => null),
      );
      if (!response.ok)
        throw new Error(parsed.message ?? "تغییر شرکت انجام نشد.");

      // Tenant identity is part of every tenant query. Clear prior data before
      // loading the newly issued session context, so old-company data cannot flash.
      queryClient.clear();
      const next = await getAuthMe();
      if (!next || next.authContext.companyId !== companyId) {
        setData(null);
        router.replace("/login");
        return;
      }
      setData(next);
      setError(null);
      router.refresh();
    },
    [queryClient, router],
  );

  const value = useMemo<AuthState>(
    () => ({
      data,
      isLoading,
      error,
      refresh,
      switchCompany,
      can: (permission) => data?.permissions?.includes(permission) ?? false,
    }),
    [data, error, isLoading, refresh, switchCompany],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuthContext must be used within AuthProvider");
  return context;
}

export function usePermission() {
  const { can, isLoading } = useAuthContext();
  return { can, isLoading };
}

export function Can({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { can, isLoading } = usePermission();
  if (isLoading || !can(permission)) return null;
  return children;
}
