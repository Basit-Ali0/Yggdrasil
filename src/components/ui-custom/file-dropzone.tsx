'use client';

import { useCallback, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Upload, FileText, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileDropzoneProps {
    accept: string;
    maxSizeMB?: number;
    onFile: (file: File) => void;
    isUploading?: boolean;
    uploadProgress?: number;
    error?: string | null;
    className?: string;
    label?: string;
    description?: string;
}

export function FileDropzone({
    accept,
    maxSizeMB = 50,
    onFile,
    isUploading = false,
    uploadProgress,
    error,
    className,
    label = 'Drop your file here',
    description = 'or click to browse',
}: FileDropzoneProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const displayError = error || localError;

    const validateAndSet = useCallback(
        (file: File) => {
            setLocalError(null);

            // Validate size
            if (file.size > maxSizeMB * 1024 * 1024) {
                setLocalError(`File exceeds ${maxSizeMB}MB limit.`);
                return;
            }

            // Validate type
            const acceptedTypes = accept.split(',').map((t) => t.trim());
            const ext = '.' + file.name.split('.').pop()?.toLowerCase();
            if (!acceptedTypes.some((type) => ext === type || file.type === type)) {
                setLocalError(`Only ${accept} files are supported.`);
                return;
            }

            setSelectedFile(file);
            onFile(file);
        },
        [accept, maxSizeMB, onFile],
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) validateAndSet(file);
        },
        [validateAndSet],
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) validateAndSet(file);
        },
        [validateAndSet],
    );

    const clearFile = () => {
        setSelectedFile(null);
        setLocalError(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div
            className={cn(
                'relative rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                isDragOver && 'border-primary bg-primary/5',
                displayError && 'border-destructive/50 bg-destructive/5',
                !isDragOver && !displayError && 'border-border hover:border-primary/50',
                isUploading && 'pointer-events-none opacity-70',
                className,
            )}
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleChange}
                className="hidden"
                aria-label="File upload"
            />

            {isUploading ? (
                <div className="space-y-3">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm font-medium">Uploading...</p>
                    {uploadProgress !== undefined && (
                        <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    )}
                </div>
            ) : selectedFile && !displayError ? (
                <div className="space-y-2">
                    <FileText className="mx-auto h-10 w-10 text-primary" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={(e) => {
                            e.stopPropagation();
                            clearFile();
                        }}
                    >
                        <X className="mr-1 h-3 w-3" />
                        Remove
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    {displayError ? (
                        <>
                            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
                            <p className="text-sm font-medium text-destructive">{displayError}</p>
                            <p className="text-xs text-muted-foreground">Try again with a valid file</p>
                        </>
                    ) : (
                        <>
                            <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-xs text-muted-foreground">{description}</p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
