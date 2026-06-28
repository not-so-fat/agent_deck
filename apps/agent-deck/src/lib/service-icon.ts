import { Service } from "@agent-deck/shared";

const API_BASE = "http://localhost:8000";

export function getServiceIconSrc(service: Service): string | null {
  if (!service.iconUrl) {
    return null;
  }

  if (service.iconUrl.startsWith("http")) {
    return service.iconUrl;
  }

  return `${API_BASE}${service.iconUrl}`;
}
