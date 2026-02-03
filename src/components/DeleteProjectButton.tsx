'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api, type Id } from '@/lib/convex';
import { Trash2 } from 'lucide-react';

export function DeleteProjectButton({ projectId }: { projectId: Id<"projects"> }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteProject = useMutation(api.projects.remove);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirming) {
      setConfirming(true);
      return;
    }

    setDeleting(true);
    await deleteProject({ id: projectId });
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
        <span className="text-muted-foreground text-xs">/</span>
        <button
          onClick={handleCancel}
          disabled={deleting}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleDelete}
      className="p-1.5 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground transition-colors"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
