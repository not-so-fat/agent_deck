import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown } from "lucide-react";
import {
  isLongToolDescription,
  toolDescriptionSummary,
} from "@/lib/tool-description";

interface ToolDescriptionCellProps {
  description: string;
  title?: string;
  expanded: boolean;
  onToggle: () => void;
}

export default function ToolDescriptionCell({
  description,
  title,
  expanded,
  onToggle,
}: ToolDescriptionCellProps) {
  const summary = toolDescriptionSummary(description, title);
  const isLong = isLongToolDescription(description, title);

  if (!description) {
    return <span className="text-gray-500">—</span>;
  }

  if (!isLong) {
    return <span>{summary}</span>;
  }

  return (
    <div className="space-y-1">
      <p className="line-clamp-3 text-sm leading-relaxed">{summary}</p>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 text-xs text-[#92E4DD] hover:text-white"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
        {expanded ? "Hide full description" : "Show full description"}
      </button>
    </div>
  );
}

interface ToolDescriptionExpandedRowProps {
  description: string;
}

export function ToolDescriptionExpandedRow({ description }: ToolDescriptionExpandedRowProps) {
  return (
    <div className="max-h-64 overflow-auto rounded border border-white/10 bg-[#0F0F0C] p-3">
      <div className="prose prose-sm prose-invert max-w-none prose-headings:text-gray-100 prose-p:text-gray-300 prose-li:text-gray-300 prose-strong:text-gray-100 prose-code:text-[#92E4DD] prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
      </div>
    </div>
  );
}

export function useToolDescriptionExpand() {
  const [expandedDescription, setExpandedDescription] = useState<string | null>(null);

  const toggleDescription = (toolName: string) => {
    setExpandedDescription((current) => (current === toolName ? null : toolName));
  };

  return { expandedDescription, toggleDescription };
}
