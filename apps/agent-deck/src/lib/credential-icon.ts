import { Credential } from "@agent-deck/shared";

export function getCredentialIconSrc(credential: Credential): string | null {
  if (!credential.iconUrl) {
    return null;
  }

  return credential.iconUrl;
}
