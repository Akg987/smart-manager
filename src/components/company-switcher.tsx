"use client";

import { useState } from "react";
import { useAuthContext } from "@/contexts/auth-context";

export function CompanySwitcher() {
  const { data, isLoading, switchCompany } = useAuthContext();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const activeCompanyId = data?.authContext.companyId ?? "";
  const companies = [
    ...new Map(
      (data?.memberships ?? []).map((item) => [item.companyId, item]),
    ).values(),
  ];

  if (companies.length < 2) return null;

  return (
    <div className="flex items-center gap-2">
      <label className="flex min-h-10 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 py-1 text-sm font-medium text-brand-ink shadow-sm">
        <span className="sr-only">شرکت فعال</span>
        <select
          aria-label="شرکت فعال"
          className="max-w-40 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-brand-copper/40 disabled:opacity-60"
          disabled={isLoading || switching}
          value={activeCompanyId}
          onChange={(event) => {
            const companyId = event.target.value;
            setError("");
            setSwitching(true);
            void switchCompany(companyId)
              .catch((cause) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "تغییر شرکت انجام نشد.",
                ),
              )
              .finally(() => setSwitching(false));
          }}
        >
          {companies.map((company) => (
            <option key={company.companyId} value={company.companyId}>
              {company.companyName}
            </option>
          ))}
        </select>
      </label>
      {switching && <span className="text-xs">در حال تغییر…</span>}
      {error && (
        <span role="alert" className="max-w-48 text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
