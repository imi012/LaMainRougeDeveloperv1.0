"use client";

import { useEffect } from "react";

function isLockAbortError(reason: any) {
  const name = reason?.name || reason?.cause?.name;
  const msg = String(reason?.message || "");
  return name === "AbortError" || msg.toLowerCase().includes("lock request is aborted");
}

/**
 * Dev-only: Next/Turbopack overlay "AbortError lock request" lenyelése.
 * Prod-ban nem fut (NODE_ENV !== 'development').
 */
export default function DevAbortErrorSilencer() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const onUnhandled = (event: PromiseRejectionEvent) => {
      if (isLockAbortError(event.reason)) {
        event.preventDefault(); // ez akadályozza meg a piros overlayt
      }
    };

    window.addEventListener("unhandledrejection", onUnhandled);
    return () => window.removeEventListener("unhandledrejection", onUnhandled);
  }, []);

  return null;
}