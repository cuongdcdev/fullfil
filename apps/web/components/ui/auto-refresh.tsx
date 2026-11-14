"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** While live data is still being fetched in the background, re-render the page a few times so it fills in. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let count = 0;
    const timer = window.setInterval(() => {
      router.refresh();
      if (++count >= 8) window.clearInterval(timer);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [active, router]);
  return null;
}
