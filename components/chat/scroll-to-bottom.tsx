import { ArrowDownIcon } from "lucide-react";
import { useStickToBottomContext } from "use-stick-to-bottom";

export function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
      <button
        type="button"
        onClick={() => scrollToBottom()}
        className="rounded-full border bg-card px-3 py-1 text-[11px] text-muted-foreground shadow-sm transition-colors hover:bg-muted"
      >
        <ArrowDownIcon size={12} className="inline-block" /> Cuộn xuống
      </button>
    </div>
  );
}
