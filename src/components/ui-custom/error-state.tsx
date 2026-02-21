import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
    title?: string;
    message: string;
    onRetry?: () => void;
    className?: string;
}

export function ErrorState({
    title = 'Something went wrong',
    message,
    onRetry,
    className,
}: ErrorStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10">
                <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
            {onRetry && (
                <Button variant="outline" className="mt-4" onClick={onRetry}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                </Button>
            )}
        </div>
    );
}
