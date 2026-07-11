import type { ApiResponse, PatchPreview, PlaybookPatch } from "@agent-deck/shared";
import { apiRequest } from "@/lib/queryClient";

async function parseApi<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new Error(body.error ?? "Request failed");
  }
  return body.data as T;
}

export async function listPlaybookPatches(
  status?: PlaybookPatch["status"],
): Promise<PlaybookPatch[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await apiRequest("GET", `/api/playbook-patches${qs}`);
  return parseApi<PlaybookPatch[]>(res);
}

export async function getPlaybookPatchPreview(id: string): Promise<PatchPreview> {
  const res = await apiRequest("GET", `/api/playbook-patches/${id}/preview`);
  return parseApi<PatchPreview>(res);
}

export async function acceptPlaybookPatch(id: string): Promise<PlaybookPatch> {
  const res = await apiRequest("POST", `/api/playbook-patches/${id}/accept`);
  return parseApi<PlaybookPatch>(res);
}

export async function rejectPlaybookPatch(
  id: string,
  reason: string,
): Promise<PlaybookPatch> {
  const res = await apiRequest("POST", `/api/playbook-patches/${id}/reject`, { reason });
  return parseApi<PlaybookPatch>(res);
}

export async function getPlaybookFetchCount(playbookId: string): Promise<number> {
  const res = await apiRequest("GET", `/api/playbooks/${playbookId}/events/count`);
  return parseApi<number>(res);
}
