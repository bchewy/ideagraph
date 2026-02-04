"use client";

import { Monitor } from "lucide-react";

export function MobileBlocker() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-background p-8 text-center md:hidden">
      <Monitor className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-xl font-semibold text-foreground">
        Desktop Only
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        IdeaGraph is designed for desktop and laptop screens. Please visit on a
        larger device for the best experience.
      </p>
    </div>
  );
}
