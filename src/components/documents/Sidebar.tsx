'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { UploadDropzone } from './UploadDropzone';
import { DocumentList } from './DocumentList';
import { Button } from '@/components/ui/button';

type Document = {
  id: string;
  filename: string;
  status: string;
  sizeBytes: number;
};

type JobStatus = {
  id: string;
  status: string;
  type: string;
  error: string | null;
};

export function Sidebar({
  projectId,
  initialDocuments,
  onGraphRefresh,
}: {
  projectId: string;
  initialDocuments: Document[];
  onGraphRefresh?: () => void;
}) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [extracting, setExtracting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshDocuments = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/documents`);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data);
    }
  }, [projectId]);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function pollJob(jobId: string) {
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;
      const data: JobStatus = await res.json();
      setJob(data);

      if (data.status === 'completed' || data.status === 'failed') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setExtracting(false);
        await refreshDocuments();
        if (data.status === 'completed') {
          onGraphRefresh?.();
        }
      }
    }, 2000);
  }

  async function handleExtract() {
    const uploadedDocs = documents.filter((d) => d.status === 'uploaded');
    if (uploadedDocs.length === 0) return;

    setExtracting(true);
    setJob(null);

    const res = await fetch(`/api/projects/${projectId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentIds: uploadedDocs.map((d) => d.id) }),
    });

    if (!res.ok) {
      setExtracting(false);
      setJob({ id: '', status: 'failed', type: 'extraction', error: 'Failed to start extraction' });
      return;
    }

    const { jobId } = await res.json();
    setJob({ id: jobId, status: 'pending', type: 'extraction', error: null });
    pollJob(jobId);
  }

  const uploadedCount = documents.filter((d) => d.status === 'uploaded').length;

  return (
    <>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Documents
      </h2>
      <UploadDropzone projectId={projectId} onUploadComplete={refreshDocuments} />
      <div className="mt-4">
        <DocumentList documents={documents} />
      </div>

      {uploadedCount > 0 && !extracting && (
        <Button onClick={handleExtract} className="mt-4 w-full" size="sm">
          Extract Ideas ({uploadedCount})
        </Button>
      )}

      {extracting && job && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>
            {job.status === 'pending' && 'Starting extraction...'}
            {job.status === 'running' && 'Extracting ideas...'}
          </span>
        </div>
      )}

      {!extracting && job?.status === 'completed' && (
        <p className="mt-4 text-sm text-green-600">Extraction complete.</p>
      )}

      {!extracting && job?.status === 'failed' && (
        <p className="mt-4 text-sm text-red-600">
          Extraction failed: {job.error}
        </p>
      )}
    </>
  );
}
