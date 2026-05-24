export default function AdminStatusBadge({
  status,
  variant,
}: {
  status: string;
  variant: "shopify" | "stripe";
}) {
  const styles =
    variant === "shopify"
      ? "bg-green-100 text-green-800"
      : status === "succeeded"
        ? "bg-purple-100 text-purple-800"
        : "bg-[#f3f4f6] text-[#4b5563]";

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
