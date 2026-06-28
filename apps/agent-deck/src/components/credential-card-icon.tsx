import { Credential } from "@agent-deck/shared";
import { KeyRound } from "lucide-react";
import { getCredentialIconSrc } from "@/lib/credential-icon";

interface CredentialCardIconProps {
  credential: Credential;
  color: string;
}

export default function CredentialCardIcon({ credential, color }: CredentialCardIconProps) {
  const iconSrc = getCredentialIconSrc(credential);

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt=""
        className="h-7 w-7 object-contain rounded-sm"
        draggable={false}
      />
    );
  }

  return <KeyRound className="h-7 w-7" strokeWidth={2.25} style={{ color }} />;
}
