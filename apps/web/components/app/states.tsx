import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StateProps {
  title: string;
  description?: string;
  className?: string;
}

interface ActionStateProps extends StateProps {
  actionLabel?: string;
  onAction?: () => void;
}

function StateFrame({
  title,
  description,
  className,
  icon,
  actionLabel,
  onAction,
}: ActionStateProps & { icon: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid min-h-[240px] place-items-center rounded-xl border border-dashed bg-card p-8 text-center",
        className,
      )}
      role="status"
    >
      <div className="flex max-w-md flex-col items-center gap-3">
        <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {actionLabel && onAction ? (
          <Button className="mt-2" onClick={onAction}>{actionLabel}</Button>
        ) : null}
      </div>
    </div>
  );
}

export function LoadingState({
  title = "Loading",
  description,
  className,
}: Partial<StateProps>) {
  return (
    <StateFrame
      title={title}
      description={description}
      className={className}
      icon={<LoaderCircle className="size-6 animate-spin" />}
    />
  );
}

export function EmptyState({ title, description, className }: StateProps) {
  return (
    <StateFrame
      title={title}
      description={description}
      className={className}
      icon={<Inbox className="size-6" />}
    />
  );
}

export function ErrorState(props: ActionStateProps) {
  return <StateFrame {...props} icon={<AlertTriangle className="size-6" />} />;
}
