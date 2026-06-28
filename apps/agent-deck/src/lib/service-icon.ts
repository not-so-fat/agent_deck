import { Service } from "@agent-deck/shared";

export function getServiceIconSrc(service: Service): string | null {
  if (!service.iconUrl) {
    return null;
  }

  return service.iconUrl;
}
