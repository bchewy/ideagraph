'use client';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type NodeInspectorData = {
  label: string;
  summary: string;
  tags: string[];
  sources: { documentId: string; filename: string; excerpt: string }[];
};

export function NodeInspector({
  data,
  onClose,
}: {
  data: NodeInspectorData;
  onClose: () => void;
}) {
  return (
    <aside className="w-80 shrink-0 border-l bg-background overflow-y-auto">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold truncate">{data.label}</h2>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X />
          <span className="sr-only">Close inspector</span>
        </Button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <section>
          <h3 className="text-xs font-medium text-muted-foreground mb-1">Summary</h3>
          <p className="text-sm leading-relaxed">{data.summary}</p>
        </section>

        {data.tags.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1">
              {data.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {data.sources.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">
              Evidence ({data.sources.length})
            </h3>
            <div className="flex flex-col gap-2">
              {data.sources.map((source, index) => (
                <Card key={`${source.documentId}-${index}`} className="py-3">
                  <CardHeader className="px-3 py-0">
                    <CardTitle className="text-xs text-muted-foreground">
                      {source.filename}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 py-0">
                    <blockquote className="border-l-2 pl-3 text-sm italic leading-relaxed">
                      {source.excerpt}
                    </blockquote>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
