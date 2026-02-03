'use client';

import { useState, useEffect, useCallback } from 'react';
import { UploadDropzone } from './UploadDropzone';
import { DocumentList } from './DocumentList';

type Document = {
  id: string;
  filename: string;
  status: string;
  sizeBytes: number;
};

export function Sidebar({
  projectId,
  initialDocuments,
}: {
  projectId: string;
  initialDocuments: Document[];
}) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);

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

  return (
    <>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Documents
      </h2>
      <UploadDropzone projectId={projectId} onUploadComplete={refreshDocuments} />
      <div className="mt-4">
        <DocumentList documents={documents} />
      </div>
    </>
  );
}
