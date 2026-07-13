import type { TriggerConflict } from "@agent-deck/shared";
import { Badge } from "@/components/ui/badge";

export function parseTriggerConflicts(json: string | null | undefined): TriggerConflict[] {
  if (!json) {
    return [];
  }
  try {
    return JSON.parse(json) as TriggerConflict[];
  } catch {
    return [];
  }
}

type PlaybookPatchTriggerConflictsProps = {
  conflicts: TriggerConflict[];
  title?: string;
};

export function PlaybookPatchTriggerConflicts({
  conflicts,
  title = "Trigger overlap warnings",
}: PlaybookPatchTriggerConflictsProps) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-50">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-200/90">{title}</p>
      <p className="mt-2 text-amber-100/90">
        These triggers overlap with other playbooks on the deck. Accept is still allowed — disambiguate
        triggers or propose a merge if the wrong playbook keeps firing.
      </p>
      <ul className="mt-3 space-y-2">
        {conflicts.map((conflict) => (
          <li
            key={`${conflict.trigger}-${conflict.otherPlaybookId}-${conflict.level}`}
            className="rounded border border-amber-500/20 bg-gray-950/60 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-amber-400/40 text-amber-100">
                {conflict.level}
              </Badge>
              <span className="font-medium text-amber-50">{conflict.otherPlaybookTitle}</span>
              <span className="font-mono text-xs text-amber-200/70">{conflict.otherPlaybookId}</span>
            </div>
            <p className="mt-2 text-amber-100/90">
              <span className="text-amber-200/80">Candidate:</span> {conflict.trigger}
            </p>
            <p className="text-amber-100/80">
              <span className="text-amber-200/80">Other:</span> {conflict.otherTrigger}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
