'use client';

import { useState, useCallback, useRef } from 'react';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function UploadDropzone({
  projectId,
  onUploadComplete,
}: {
  projectId: string;
  onUploadComplete?: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const pdfs = Array.from(files).filter(
        (f) => f.type === 'application/pdf'
      );
      if (pdfs.length === 0) {
        setProgress('Only PDF files are accepted.');
        return;
      }

      const oversized = pdfs.find((f) => f.size > MAX_FILE_SIZE);
      if (oversized) {
        setProgress(`File "${oversized.name}" exceeds 50MB limit.`);
        return;
      }

      setUploading(true);
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
          return;
        }
      }

      setProgress(`Uploaded ${pdfs.length} file(s).`);
      setUploading(false);
      onUploadComplete?.();
    },
    [projectId, onUploadComplete]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
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
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
      >
        <p className="text-sm font-medium">
          {uploading ? progress : 'Drop PDFs here or click to browse'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">PDF files, max 50MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
          }}
        />
      </div>
      {!uploading && progress && (
        <p className="mt-2 text-xs text-muted-foreground">{progress}</p>
      )}
    </div>
  );
}
