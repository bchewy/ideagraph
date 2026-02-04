'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api, type Id } from '@/lib/convex';
import { UploadDropzone } from './UploadDropzone';
import { DocumentList } from './DocumentList';
import { Button } from '@/components/ui/button';
import { Sparkles, Link2, Loader2, CheckCircle2, XCircle, Crosshair } from 'lucide-react';

export function Sidebar({ projectId }: { projectId: Id<"projects"> }) {
  const documents = useQuery(api.documents.list, { projectId });
  const startExtraction = useMutation(api.extraction.start);
  const startLinkingMutation = useMutation(api.linking.start);

  const [extractionJobId, setExtractionJobId] = useState<Id<"jobs"> | null>(null);
  const [, setBackfillJobId] = useState<Id<"jobs"> | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<
    'idle' | 'running' | 'completed' | 'failed'
  >('idle');
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [linkingJobId, setLinkingJobId] = useState<Id<"jobs"> | null>(null);

  const latestLinkingJob = useQuery(api.jobs.getLatestByType, {
    projectId,
    type: 'linking',
    statuses: ['pending', 'running'],
  });

  // Reactive job status — no polling needed!
  const extractionJob = useQuery(
    api.jobs.get,
    extractionJobId ? { id: extractionJobId } : "skip"
  );
  const linkingJob = useQuery(
    api.jobs.get,
    linkingJobId ? { id: linkingJobId } : "skip"
  );

  useEffect(() => {
    if (!linkingJobId && latestLinkingJob?._id) {
      setLinkingJobId(latestLinkingJob._id);
    }
  }, [latestLinkingJob, linkingJobId]);

  const extracting =
    extractionJobId !== null &&
    (extractionJob?.status === "pending" || extractionJob?.status === "running");
  const backfilling = backfillStatus === 'running';
  const linking =
    linkingJobId !== null &&
    (linkingJob?.status === "pending" || linkingJob?.status === "running");
  const isBusy = extracting || linking || backfilling;

  // Auto-trigger linking after extraction completes (only for this session)
  const prevExtractionStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      prevExtractionStatus.current !== "completed" &&
      extractionJob?.status === "completed" &&
      !linkingJobId
    ) {
      handleStartLinking();
    }
    prevExtractionStatus.current = extractionJob?.status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractionJob?.status]);

  async function handleExtract() {
    const uploadedDocs = (documents ?? []).filter((d) => d.status === "uploaded");
    if (uploadedDocs.length === 0) return;

    setLinkingJobId(null);
    const jobId = await startExtraction({
      projectId,
      documentIds: uploadedDocs.map((d) => d._id),
    });
    setExtractionJobId(jobId);
  }

  async function handleStartLinking() {
    const jobId = await startLinkingMutation({ projectId });
    setLinkingJobId(jobId);
  }

  async function handleStartBackfill() {
    try {
      setBackfillStatus('running');
      setBackfillMessage('Backfilling evidence locators...');
      setBackfillJobId(null);
      const response = await fetch(`/api/projects/${projectId}/backfill-locators`, {
        method: 'POST',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Backfill failed');
      }
      const payload = await response.json().catch(() => ({}));
      const updated = payload.updated as number | undefined;
      setBackfillStatus('completed');
      setBackfillMessage(
        `Backfilled ${updated ?? 0} locator${updated === 1 ? '' : 's'}.`
      );
    } catch (error) {
      setBackfillStatus('failed');
      setBackfillMessage(
        error instanceof Error ? error.message : 'Backfill failed'
      );
    }
  }

  const uploadedCount = (documents ?? []).filter((d) => d.status === "uploaded").length;
  const extractedCount = (documents ?? []).filter((d) => d.status === "extracted").length;

  return (
    <>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Documents
      </h2>
      <UploadDropzone projectId={projectId} />
      <div className="mt-4">
        <DocumentList documents={documents ?? []} />
      </div>

      {/* Extract button */}
      {uploadedCount > 0 && !isBusy && (
        <Button onClick={handleExtract} className="mt-4 w-full gap-2" size="sm">
          <Sparkles className="size-3.5" />
          Extract Ideas ({uploadedCount})
        </Button>
      )}

      {/* Link button (manual) */}
      {!isBusy && extractedCount > 0 && uploadedCount === 0 && !linkingJob && (
        <Button onClick={handleStartLinking} variant="outline" className="mt-4 w-full gap-2" size="sm">
          <Link2 className="size-3.5" />
          Link Ideas
        </Button>
      )}

      {/* Backfill locators */}
      {!isBusy && extractedCount > 0 && (
        <Button onClick={handleStartBackfill} variant="outline" className="mt-3 w-full gap-2" size="sm">
          <Crosshair className="size-3.5" />
          Backfill Evidence Locators
        </Button>
      )}

      {/* Re-link button */}
      {!isBusy && linkingJob?.status === "completed" && (
        <Button onClick={handleStartLinking} variant="outline" className="mt-3 w-full gap-2" size="sm">
          <Link2 className="size-3.5" />
          Re-link Ideas
        </Button>
      )}

      {/* Status messages */}
      <div className="mt-4 space-y-2">
        {extracting && extractionJob && (
          <div className="rounded-lg border border-border/60 bg-card/30 px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
              <span>
                {extractionJob.progressMessage ??
                  (extractionJob.status === "pending"
                    ? "Starting extraction..."
                    : "Extracting ideas...")}
              </span>
            </div>

            {/* Progress bar */}
            {extractionJob.progressTotal != null &&
              extractionJob.progressTotal > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.round(
                          ((extractionJob.progressCurrent ?? 0) /
                            extractionJob.progressTotal) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground/70">
                    <span>
                      {extractionJob.progressCurrent ?? 0} / {extractionJob.progressTotal} docs
                    </span>
                    {(extractionJob.ideasExtracted ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="size-3" />
                        {extractionJob.ideasExtracted} idea{extractionJob.ideasExtracted === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        {!extracting && extractionJob?.status === "completed" && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="size-3.5" />
              Extraction complete
            </div>
            {extractionJob.progressMessage && (
              <p className="text-[11px] text-green-400/70 pl-5.5">
                {extractionJob.progressMessage}
              </p>
            )}
          </div>
        )}

        {!extracting && extractionJob?.status === "failed" && (
          <div className="flex items-center gap-2 text-sm text-red-400 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <XCircle className="size-3.5" />
            <span className="truncate">Extraction failed: {extractionJob.error}</span>
          </div>
        )}

        {linking && linkingJob && (
          <div className="rounded-lg border border-border/60 bg-card/30 px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
              <span>
                {linkingJob.progressMessage ??
                  (linkingJob.status === "pending"
                    ? "Starting linking..."
                    : "Linking ideas...")}
              </span>
            </div>

            {/* Progress bar */}
            {linkingJob.progressTotal != null &&
              linkingJob.progressTotal > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.round(
                          ((linkingJob.progressCurrent ?? 0) /
                            linkingJob.progressTotal) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground/70">
                    <span>
                      {linkingJob.progressCurrent ?? 0} / {linkingJob.progressTotal} batch{linkingJob.progressTotal === 1 ? "" : "es"}
                    </span>
                    {(linkingJob.linksCreated ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Link2 className="size-3" />
                        {linkingJob.linksCreated} link{linkingJob.linksCreated === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        {backfilling && (
          <div className="rounded-lg border border-border/60 bg-card/30 px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
              <span>
                {backfillMessage ?? 'Backfilling evidence locators...'}
              </span>
            </div>
          </div>
        )}

        {!backfilling && backfillStatus === 'completed' && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="size-3.5" />
              Locator backfill complete
            </div>
            {backfillMessage && (
              <p className="text-[11px] text-green-400/70 pl-5.5">{backfillMessage}</p>
            )}
          </div>
        )}

        {!backfilling && backfillStatus === 'failed' && (
          <div className="flex items-center gap-2 text-sm text-red-400 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <XCircle className="size-3.5" />
            <span className="truncate">Locator backfill failed: {backfillMessage}</span>
          </div>
        )}

        {!linking && linkingJob?.status === "completed" && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="size-3.5" />
              Linking complete
            </div>
            {linkingJob.progressMessage && (
              <p className="text-[11px] text-green-400/70 pl-5.5">
                {linkingJob.progressMessage}
              </p>
            )}
          </div>
        )}

        {!linking && linkingJob?.status === "failed" && (
          <div className="flex items-center gap-2 text-sm text-red-400 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <XCircle className="size-3.5" />
            <span className="truncate">Linking failed: {linkingJob.error}</span>
          </div>
        )}
      </div>
    </>
  );
}
