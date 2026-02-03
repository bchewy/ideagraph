import { Badge } from '@/components/ui/badge';

type Document = {
  _id: string;
  filename: string;
  status: string;
  sizeBytes: number;
};

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

export function DocumentList({ documents }: { documents: Document[] }) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No documents yet. Upload a PDF to get started.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li
          key={doc._id}
          className="rounded-md border p-2 text-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="truncate font-medium">{doc.filename}</span>
            <Badge variant={statusVariant[doc.status] ?? 'secondary'}>
              {doc.status}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(doc.sizeBytes)}
          </span>
        </li>
      ))}
    </ul>
  );
}
