'use client';

import { useState, useCallback, useRef } from 'react';
import type { Id } from '@/lib/convex';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function UploadDropzone({
  projectId,
}: {
  projectId: Id<"projects">;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadPercent =
    uploadTotal > 0 ? Math.round((uploadedCount / uploadTotal) * 100) : 0;

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (uploading) return;

      const pdfs = Array.from(files).filter(
        (f) => f.type === 'application/pdf'
      );
      if (pdfs.length === 0) {
        setProgress('Only PDF files are accepted.');
        setUploadTotal(0);
        setUploadedCount(0);
        return;
      }

      const oversized = pdfs.find((f) => f.size > MAX_FILE_SIZE);
      if (oversized) {
        setProgress(`File "${oversized.name}" exceeds 50MB limit.`);
        setUploadTotal(0);
        setUploadedCount(0);
        return;
      }

      setUploading(true);
      setUploadTotal(pdfs.length);
      setUploadedCount(0);
      try {
        for (let i = 0; i < pdfs.length; i++) {
          const file = pdfs[i];
          setProgress(`Uploading ${file.name} (${i + 1}/${pdfs.length})...`);

          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch(`/api/projects/${projectId}/upload`, {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            setProgress(`Failed to upload ${file.name}.`);
            setUploading(false);
            setUploadTotal(0);
            setUploadedCount(0);
            return;
          }

          setUploadedCount(i + 1);
        }

        setProgress(`Uploaded ${pdfs.length} file(s).`);
        setUploading(false);
      } catch (error) {
        setProgress(error instanceof Error ? error.message : 'Upload failed.');
        setUploading(false);
        setUploadTotal(0);
        setUploadedCount(0);
      }
      // Document list auto-refreshes via Convex reactive query
    },
    [projectId, uploading]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (uploading) return;
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (uploading) return;
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (uploading) return;
          fileInputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (uploading) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={uploading ? -1 : 0}
        aria-disabled={uploading}
        aria-busy={uploading}
        className={cn(
          'relative flex flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed p-6 text-center transition-[border-color,background-color,box-shadow] duration-200',
          uploading
            ? 'cursor-default border-primary/40 bg-primary/5 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_0_30px_rgba(255,255,255,0.06)]'
            : isDragOver
              ? 'cursor-pointer border-primary bg-primary/5'
              : 'cursor-pointer border-muted-foreground/25 hover:border-muted-foreground/50'
        )}
      >
        {uploading && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.10),transparent_55%)] opacity-70" />
            <div className="absolute inset-y-0 left-0 w-[45%] bg-gradient-to-r from-transparent via-primary/12 to-transparent animate-upload-sheen motion-reduce:animate-none" />
          </div>
        )}

        <div className="relative z-10 flex w-full flex-col items-center">
          <p className="text-sm font-medium">
            {uploading ? (
              <span className="inline-flex items-center gap-2 text-foreground/95">
                <Loader2 className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
                <span className="break-words">{progress}</span>
              </span>
            ) : (
              'Drop PDFs here or click to browse'
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF files, max 50MB
          </p>

          {uploading && uploadTotal > 0 && (
            <div className="mt-3 w-full max-w-[340px]">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-primary/60 transition-[width] duration-300 ease-out"
                  style={{ width: `${uploadPercent}%` }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-70"
                >
                  <div className="absolute inset-y-0 left-0 w-[45%] bg-gradient-to-r from-transparent via-primary/18 to-transparent animate-upload-sheen motion-reduce:animate-none" />
                </div>
              </div>
              <div className="mt-2 flex w-full justify-between text-[11px] tabular-nums text-muted-foreground/70">
                <span>
                  {uploadedCount} / {uploadTotal}
                </span>
                <span>{uploadPercent}%</span>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            // Allow picking the same file twice in a row.
            e.currentTarget.value = '';
          }}
        />
      </div>
      {!uploading && progress && (
        <p className="mt-2 text-xs text-muted-foreground">{progress}</p>
      )}
    </div>
  );
}
