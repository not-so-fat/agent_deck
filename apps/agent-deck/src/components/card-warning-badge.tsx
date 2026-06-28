import { AlertTriangle } from "lucide-react";
import type { CollectionCardWarning } from "@/lib/collection-warnings";

interface CardWarningBadgeProps {
  warnings?: CollectionCardWarning[];
}

export default function CardWarningBadge({ warnings }: CardWarningBadgeProps) {
  if (!warnings?.length) {
    return null;
  }

  const primary =
    warnings.find((warning) => warning.severity === "error") ?? warnings[0];
  const isError = primary.severity === "error";

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 top-8 z-20 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wide shadow-lg ${
        isError
          ? "bg-red-500/90 text-white border border-red-300/60"
          : "bg-amber-500/90 text-black border border-amber-200/60"
      }`}
      title={warnings.map((warning) => warning.message).join(" · ")}
      data-testid="card-warning-badge"
    >
      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
      <span className="max-w-[72px] truncate">{primary.message}</span>
    </div>
  );
}
