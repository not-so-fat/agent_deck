import { useState } from "react";
import type { Service } from "@agent-deck/shared";
import agentIconUrl from "@/assets/icons/Agent2.svg";
import { getServiceCardColor } from "@/lib/card-colors";
import { getServiceIconSrc } from "@/lib/service-icon";

interface ServiceCardIconProps {
  service: Service;
}

export default function ServiceCardIcon({ service }: ServiceCardIconProps) {
  const color = getServiceCardColor(service);
  const iconSrc = getServiceIconSrc(service);
  const [faviconFailed, setFaviconFailed] = useState(false);

  if (iconSrc && !faviconFailed) {
    return (
      <img
        src={iconSrc}
        alt=""
        className="w-7 h-7 object-contain rounded-sm"
        draggable={false}
        onError={() => setFaviconFailed(true)}
      />
    );
  }

  return (
    <div
      style={{
        width: 28,
        height: 28,
        backgroundColor: color,
        WebkitMask: `url(${agentIconUrl}) no-repeat center / contain`,
        mask: `url(${agentIconUrl}) no-repeat center / contain`,
      }}
      aria-hidden
    />
  );
}
