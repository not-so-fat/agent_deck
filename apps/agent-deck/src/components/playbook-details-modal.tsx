import { useQuery } from "@tanstack/react-query";
import { PlaybookWithDependencies } from "@agent-deck/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface PlaybookDetailsModalProps {
  playbookId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PlaybookDetailsModal({
  playbookId,
  open,
  onOpenChange,
}: PlaybookDetailsModalProps) {
  const { data: response, isLoading } = useQuery<{ success: boolean; data: PlaybookWithDependencies }>({
    queryKey: playbookId ? [`/api/playbooks/${playbookId}`] : ["playbook-detail-disabled"],
    enabled: open && Boolean(playbookId),
  });

  const playbook = response?.data;
  const missingDeps =
    (playbook?.dependencies.missingCredentialIds.length ?? 0) +
    (playbook?.dependencies.missingServiceIds.length ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border-border bg-[#161612] text-[#E8F6F4]">
        <DialogHeader>
          <DialogTitle>{playbook?.title ?? "Playbook"}</DialogTitle>
          <DialogDescription className="text-[#A8C4C0]">
            {playbook?.id ?? playbookId}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !playbook ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-4 text-sm">
            <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[#A8C4C0]">
              Ask your AI agent to refine this playbook with{" "}
              <span className="font-mono text-xs">update_playbook</span> — dependencies are
              re-detected from the content automatically.
            </p>

            {playbook.triggers.length > 0 && (
              <div>
                <h4 className="font-semibold text-amber-200 mb-1">Triggers</h4>
                <p className="text-gray-300">{playbook.triggers.join(", ")}</p>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-amber-200 mb-1">Dependencies</h4>
              {playbook.dependencies.credentials.length === 0 &&
              playbook.dependencies.services.length === 0 &&
              missingDeps === 0 ? (
                <p className="text-gray-400">None declared.</p>
              ) : (
                <ul className="space-y-1 text-gray-300">
                  {playbook.dependencies.credentials.map((item) => (
                    <li key={item.id}>API key: {item.label}</li>
                  ))}
                  {playbook.dependencies.services.map((item) => (
                    <li key={item.id}>MCP: {item.label}</li>
                  ))}
                  {playbook.dependencies.missingCredentialIds.map((id) => (
                    <li key={id} className="text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Missing API key: {id}
                    </li>
                  ))}
                  {playbook.dependencies.missingServiceIds.map((id) => (
                    <li key={id} className="text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Missing MCP: {id}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {playbook.exec && (
              <div>
                <h4 className="font-semibold text-amber-200 mb-1">Suggested exec</h4>
                <pre className="rounded bg-black/40 p-2 text-xs overflow-x-auto">{playbook.exec}</pre>
              </div>
            )}

            {playbook.skill && (
              <div>
                <h4 className="font-semibold text-amber-200 mb-1">Skill hint</h4>
                <p className="font-mono text-xs text-gray-300">{playbook.skill}</p>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-amber-200 mb-1">Instructions</h4>
              <div className="rounded bg-black/30 p-3 whitespace-pre-wrap text-gray-200">
                {playbook.body}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
