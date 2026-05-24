import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import AdminLoginForm from "./AdminLoginForm";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-[#f3f4f6] text-[#111827]">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl font-medium tracking-tight">Admin sign in</h1>
          <p className="mt-2 text-sm text-[#4b5563]">Enter your credentials to continue.</p>
          <div className="mt-6">
            <Suspense fallback={<p className="text-sm text-[#4b5563]">Loading...</p>}>
              <AdminLoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
