"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InvoiceConfigRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/billings/template");
  }, [router]);
  return null;
}
