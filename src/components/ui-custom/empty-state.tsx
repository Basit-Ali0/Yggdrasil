import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <Icon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
            {action && (
                <Button className="mt-4" onClick={action.onClick}>
                    {action.label}
                </Button>
            )}
        </div>
    );
}
