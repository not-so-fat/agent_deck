import { Credential } from "@agent-deck/shared";

const API_BASE = "http://localhost:8000";

export function getCredentialIconSrc(credential: Credential): string | null {
  if (!credential.iconUrl) {
    return null;
  }

  if (credential.iconUrl.startsWith("http")) {
    return credential.iconUrl;
  }

  return `${API_BASE}${credential.iconUrl}`;
}
