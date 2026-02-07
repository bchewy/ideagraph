'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation } from 'convex/react';
import { api, type Doc, type Id } from '@/lib/convex';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronDown, FileText, Folder, MoveRight, Search, Settings2 } from 'lucide-react';

type Document = Doc<'documents'>;
type FolderDoc = Doc<'documentFolders'>;
type FolderFilter = 'all' | 'unfiled' | Id<'documentFolders'>;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  uploaded: 'secondary',
  extracting: 'default',
  extracted: 'outline',
};

function docFolderId(doc: Document): Id<'documentFolders'> | null {
  return doc.folderId ?? null;
}

const selectClassName = cn(
  'h-9 w-full appearance-none rounded-md border border-border bg-muted/10 pl-3 pr-8 text-sm text-foreground/90 shadow-xs outline-none',
  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
);

function SelectChevron() {
  return (
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
  );
}

function FolderNavItem({
  active,
  label,
  count,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-foreground/85 hover:bg-muted/20'
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate text-xs font-medium">{label}</span>
      </span>
      <span
        className={cn(
          'text-[11px] tabular-nums',
          active ? 'text-primary/80' : 'text-muted-foreground/70'
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ManageDocumentsDialogContent({
  projectId,
  documents,
  folders,
  initialFolderFilter,
  initialQuery,
  onClose,
}: {
  projectId: Id<'projects'>;
  documents: Document[];
  folders: FolderDoc[];
  initialFolderFilter: FolderFilter;
  initialQuery: string;
  onClose: () => void;
}) {
  const createFolder = useMutation(api.folders.create);
  const renameFolder = useMutation(api.folders.rename);
  const removeFolder = useMutation(api.folders.remove);
  const bulkSetFolder = useMutation(api.documents.bulkSetFolder);

  const [folderFilter, setFolderFilter] = useState<FolderFilter>(initialFolderFilter);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest');

  const [selected, setSelected] = useState<Set<Id<'documents'>>>(new Set());
  const [moveTarget, setMoveTarget] = useState<Id<'documentFolders'> | null>(
    folderFilter !== 'all' && folderFilter !== 'unfiled' ? folderFilter : null
  );

  const [newFolderName, setNewFolderName] = useState('');
  const [busy, setBusy] = useState<'create' | 'rename' | 'delete' | 'move' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const folderNameById = useMemo(() => {
    const map = new Map<Id<'documentFolders'>, string>();
    for (const folder of folders) map.set(folder._id, folder.name);
    return map;
  }, [folders]);

  const folderCounts = useMemo(() => {
    const map = new Map<Id<'documentFolders'>, number>();
    for (const doc of documents) {
      const fid = docFolderId(doc);
      if (!fid) continue;
      map.set(fid, (map.get(fid) ?? 0) + 1);
    }
    return map;
  }, [documents]);

  const unfiledCount = useMemo(() => {
    let n = 0;
    for (const doc of documents) {
      if (!docFolderId(doc)) n++;
    }
    return n;
  }, [documents]);

  function setActiveFolder(next: FolderFilter) {
    setFolderFilter(next);
    setSelected(new Set());
    setMoveTarget(next !== 'all' && next !== 'unfiled' ? next : null);
  }

  const visibleDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = documents;

    if (folderFilter !== 'all') {
      if (folderFilter === 'unfiled') list = list.filter((d) => !docFolderId(d));
      else list = list.filter((d) => docFolderId(d) === folderFilter);
    }

    if (q) list = list.filter((d) => d.filename.toLowerCase().includes(q));

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === 'name') return a.filename.localeCompare(b.filename);
      if (sort === 'oldest') return a._creationTime - b._creationTime;
      return b._creationTime - a._creationTime;
    });

    return sorted;
  }, [documents, folderFilter, query, sort]);

  const allVisibleSelected =
    visibleDocs.length > 0 && visibleDocs.every((d) => selected.has(d._id));

  function toggleSelected(id: Id<'documents'>) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      setError(null);
      setBusy('create');
      const id = await createFolder({ projectId, name });
      setNewFolderName('');
      setActiveFolder(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Folder creation failed.');
    } finally {
      setBusy(null);
    }
  }

  async function handleMoveSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      setError(null);
      setBusy('move');
      await bulkSetFolder({ documentIds: ids, folderId: moveTarget });
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed.');
    } finally {
      setBusy(null);
    }
  }

  const activeFolderName =
    folderFilter !== 'all' && folderFilter !== 'unfiled'
      ? (folderNameById.get(folderFilter) ?? '')
      : '';

  return (
    <DialogContent className="max-w-5xl w-[92vw] h-[82vh] p-0 overflow-hidden flex flex-col">
      <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4">
        <DialogTitle className="text-base">Manage documents</DialogTitle>
        <DialogDescription className="text-xs">
          Create folders, rename them, and move PDFs in bulk.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-auto">
        <div className="p-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
          {/* Folders */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Folders
                </p>
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  {folders.length}
                </span>
              </div>

              <div className="space-y-1">
                <FolderNavItem
                  active={folderFilter === 'all'}
                  label="All documents"
                  count={documents.length}
                  onClick={() => setActiveFolder('all')}
                />
                <FolderNavItem
                  active={folderFilter === 'unfiled'}
                  label="Unfiled"
                  count={unfiledCount}
                  onClick={() => setActiveFolder('unfiled')}
                />
                {folders.map((folder) => (
                  <FolderNavItem
                    key={folder._id}
                    active={folderFilter === folder._id}
                    label={folder.name}
                    count={folderCounts.get(folder._id) ?? 0}
                    icon={<Folder className="size-3.5 text-muted-foreground/70 shrink-0" />}
                    onClick={() => setActiveFolder(folder._id)}
                  />
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-border/70 space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground">New folder</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g. Literature review"
                    className="h-9 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder();
                    }}
                    disabled={busy === 'create'}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateFolder}
                    disabled={busy === 'create' || !newFolderName.trim()}
                  >
                    Create
                  </Button>
                </div>
              </div>
            </div>

            {folderFilter !== 'all' && folderFilter !== 'unfiled' && (
              <div className="rounded-xl border border-border/70 bg-muted/10 p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Folder settings
                </p>
                <Input
                  key={folderFilter}
                  defaultValue={activeFolderName}
                  className="h-9 text-sm"
                  aria-label="Rename folder"
                  onKeyDown={async (e) => {
                    if (e.key !== 'Enter') return;
                    const nextName = (e.currentTarget.value ?? '').trim();
                    if (!nextName || nextName === activeFolderName) return;
                    try {
                      setError(null);
                      setBusy('rename');
                      await renameFolder({ id: folderFilter, name: nextName });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Rename failed.');
                    } finally {
                      setBusy(null);
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy === 'rename'}
                    onClick={async (e) => {
                      const input = (e.currentTarget
                        .parentElement
                        ?.previousElementSibling ?? null) as HTMLInputElement | null;
                      const nextName = (input?.value ?? '').trim();
                      if (!nextName || nextName === activeFolderName) return;
                      try {
                        setError(null);
                        setBusy('rename');
                        await renameFolder({ id: folderFilter, name: nextName });
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Rename failed.');
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Save name
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy === 'delete'}
                    onClick={async () => {
                      const ok = window.confirm(
                        `Delete folder \"${activeFolderName}\"? Documents will be moved to Unfiled.`
                      );
                      if (!ok) return;
                      try {
                        setError(null);
                        setBusy('delete');
                        await removeFolder({ id: folderFilter });
                        setActiveFolder('all');
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Delete failed.');
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="rounded-xl border border-border/70 bg-card/20 overflow-hidden flex flex-col min-h-[360px]">
            <div className="shrink-0 p-3 border-b border-border/70 bg-background/40 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search documents…"
                    className="h-9 pl-9 text-sm"
                  />
                </div>
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                    className={cn(selectClassName, 'w-[140px] pr-8')}
                    aria-label="Sort documents"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">Name</option>
                  </select>
                  <SelectChevron />
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}
            </div>

            <div className="shrink-0 p-3 border-b border-border/70 bg-background/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={() => {
                      if (allVisibleSelected) {
                        const next = new Set(selected);
                        for (const doc of visibleDocs) next.delete(doc._id);
                        setSelected(next);
                        return;
                      }
                      const next = new Set(selected);
                      for (const doc of visibleDocs) next.add(doc._id);
                      setSelected(next);
                    }}
                    className="size-4 accent-primary"
                  />
                  Select all
                </label>
                <span className="text-xs text-muted-foreground">
                  <span className="tabular-nums text-foreground/90">{selected.size}</span>{' '}
                  selected
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <select
                    value={moveTarget ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMoveTarget(value ? (value as Id<'documentFolders'>) : null);
                    }}
                    className={cn(selectClassName, 'w-[200px] pr-8')}
                    aria-label="Move selected to folder"
                  >
                    <option value="">Unfiled</option>
                    {folders.map((folder) => (
                      <option key={folder._id} value={folder._id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleMoveSelected}
                  disabled={busy === 'move' || selected.size === 0}
                >
                  <MoveRight className="size-3.5" />
                  Move
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {visibleDocs.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No documents match your filters.
                </div>
              ) : (
                <ul className="divide-y divide-border/70">
                  {visibleDocs.map((doc) => (
                    <li key={doc._id} className="px-3 py-3 hover:bg-muted/10 transition-colors">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(doc._id)}
                          onChange={() => toggleSelected(doc._id)}
                          className="mt-0.5 size-4 accent-primary"
                          aria-label={`Select ${doc.filename}`}
                        />
                        <FileText className="mt-0.5 size-4 text-muted-foreground/70 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="truncate text-sm font-medium text-foreground/90">
                              {doc.filename}
                            </p>
                            <Badge
                              variant={statusVariant[doc.status] ?? 'secondary'}
                              className="text-[10px]"
                            >
                              {doc.status}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                            {formatFileSize(doc.sizeBytes)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border/70 bg-background/40 px-5 py-4 flex justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </DialogContent>
  );
}

export function DocumentList({
  projectId,
  documents,
  folders,
}: {
  projectId: Id<'projects'>;
  documents: Document[];
  folders: FolderDoc[];
}) {
  const showOrganizer = documents.length > 5 || folders.length > 0;

  const [query, setQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all');
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSeed, setManageSeed] = useState<{ folderFilter: FolderFilter; query: string }>({
    folderFilter: 'all',
    query: '',
  });

  const folderNameById = useMemo(() => {
    const map = new Map<Id<'documentFolders'>, string>();
    for (const folder of folders) map.set(folder._id, folder.name);
    return map;
  }, [folders]);

  const folderCounts = useMemo(() => {
    const map = new Map<Id<'documentFolders'>, number>();
    for (const doc of documents) {
      const fid = docFolderId(doc);
      if (!fid) continue;
      map.set(fid, (map.get(fid) ?? 0) + 1);
    }
    return map;
  }, [documents]);

  const unfiledCount = useMemo(() => {
    let n = 0;
    for (const doc of documents) {
      if (!docFolderId(doc)) n++;
    }
    return n;
  }, [documents]);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = documents;

    if (folderFilter !== 'all') {
      if (folderFilter === 'unfiled') list = list.filter((d) => !docFolderId(d));
      else list = list.filter((d) => docFolderId(d) === folderFilter);
    }

    if (q) list = list.filter((d) => d.filename.toLowerCase().includes(q));

    return [...list].sort((a, b) => b._creationTime - a._creationTime);
  }, [documents, folderFilter, query]);

  const grouped = useMemo(() => {
    const groups: Array<{ key: string; label: string; docs: Document[] }> = [
      { key: 'extracting', label: 'Extracting', docs: [] },
      { key: 'uploaded', label: 'Uploaded', docs: [] },
      { key: 'extracted', label: 'Extracted', docs: [] },
      { key: 'other', label: 'Other', docs: [] },
    ];

    const byKey = new Map(groups.map((g) => [g.key, g]));
    for (const doc of filteredDocs) {
      const key = byKey.has(doc.status) ? doc.status : 'other';
      byKey.get(key)!.docs.push(doc);
    }

    return groups.filter((g) => g.docs.length > 0);
  }, [filteredDocs]);

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No documents yet. Upload a PDF to get started.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {showOrganizer && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PDFs…"
              className="h-9 pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Folder className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
              <select
                value={folderFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  setFolderFilter(
                    value === 'all' || value === 'unfiled'
                      ? (value as FolderFilter)
                      : (value as Id<'documentFolders'>)
                  );
                }}
                className={cn(selectClassName, 'pl-9 pr-8')}
                aria-label="Folder filter"
              >
                <option value="all">All documents ({documents.length})</option>
                <option value="unfiled">Unfiled ({unfiledCount})</option>
                {folders.map((folder) => (
                  <option key={folder._id} value={folder._id}>
                    {folder.name} ({folderCounts.get(folder._id) ?? 0})
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setManageSeed({ folderFilter, query });
                setManageOpen(true);
              }}
              className="shrink-0"
            >
              <Settings2 className="size-3.5" />
              Manage
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {grouped.map((group) => (
          <div key={group.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {group.label}
              </span>
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-[10px] tabular-nums text-muted-foreground/60">
                {group.docs.length}
              </span>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/20 overflow-hidden">
              <ul className="divide-y divide-border/70">
                {group.docs.map((doc) => {
                  const fid = docFolderId(doc);
                  const folderName = fid ? folderNameById.get(fid) : null;
                  return (
                    <li
                      key={doc._id}
                      className="px-3 py-3 hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="truncate text-sm font-medium text-foreground/90">
                              {doc.filename}
                            </p>
                            <Badge
                              variant={statusVariant[doc.status] ?? 'secondary'}
                              className="text-[10px]"
                            >
                              {doc.status}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                            {formatFileSize(doc.sizeBytes)}
                            {folderFilter === 'all' && folderName ? ` · ${folderName}` : ''}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}

        {showOrganizer && filteredDocs.length === 0 && (
          <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
            No documents match your filters.
          </div>
        )}
      </div>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        {manageOpen && (
          <ManageDocumentsDialogContent
            projectId={projectId}
            documents={documents}
            folders={folders}
            initialFolderFilter={manageSeed.folderFilter}
            initialQuery={manageSeed.query}
            onClose={() => setManageOpen(false)}
          />
        )}
      </Dialog>
    </div>
  );
}
