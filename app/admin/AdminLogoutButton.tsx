"use client";

export default function AdminLogoutButton() {
  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="w-full shrink-0 rounded-xl border border-[#e5e7eb] px-4 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb] sm:w-auto"
    >
      Sign out
    </button>
  );
}
