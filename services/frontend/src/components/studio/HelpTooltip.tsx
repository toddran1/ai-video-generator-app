import type { ReactNode } from "react";

export function HelpTooltip({ content, className = "" }: { content: ReactNode; className?: string }) {
  return (
    <span className={`help-tooltip ${className}`.trim()} tabIndex={0}>
      <span aria-hidden="true" className="help-tooltip-trigger">
        ?
      </span>
      <span className="help-tooltip-bubble" role="tooltip">
        {content}
      </span>
    </span>
  );
}
