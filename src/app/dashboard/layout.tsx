"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="page-loader">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="dashboard-root">
        <Sidebar />
        <div className="main-area">
          <div className="page-content">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}
