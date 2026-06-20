"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InvoicesRedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/billings"); }, [router]);
  return null;
}
