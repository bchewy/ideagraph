'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  Upload,
  Sparkles,
  Link2,
  Share2,
  Search,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Step definitions                                                   */
/* ------------------------------------------------------------------ */

type Placement = 'right' | 'center-top';

type Step = {
  icon: typeof Upload;
  title: string;
  description: string;
  target: string;
  placement: Placement;
};

const STEPS: Step[] = [
  {
    icon: Upload,
    title: 'Upload PDFs',
    description:
      'Drag and drop PDF files into this dropzone or click to browse. Each uploaded document appears in the list below.',
    target: 'upload',
    placement: 'right',
  },
  {
    icon: Sparkles,
    title: 'Extract Ideas',
    description:
      'After uploading, click "Extract Ideas" here to run GPT-5.2 on your documents. The AI identifies key concepts, claims, and insights from the text.',
    target: 'sidebar-actions',
    placement: 'right',
  },
  {
    icon: Link2,
    title: 'Link Ideas',
    description:
      'Linking runs automatically after extraction. Ideas are connected by semantic similarity — relationships like "supports", "contradicts", and "extends" are created between nodes.',
    target: 'sidebar-actions',
    placement: 'right',
  },
  {
    icon: Share2,
    title: 'Explore the Graph',
    description:
      'Pan and zoom the canvas to explore your knowledge graph. Nodes are grouped by source document and edges are color-coded by relationship type.',
    target: 'graph',
    placement: 'center-top',
  },
  {
    icon: Search,
    title: 'Inspect Details',
    description:
      'Click any node or edge to open the inspector panel on the right. View the full idea text, evidence excerpts, and jump to the exact PDF location.',
    target: 'graph',
    placement: 'center-top',
  },
];

/* ------------------------------------------------------------------ */
/*  Tooltip positioning                                                */
/* ------------------------------------------------------------------ */

const SPOTLIGHT_PAD = 8;
const GAP = 16;
const TOOLTIP_W = 320;

function computeTooltipStyle(
  rect: DOMRect,
  placement: Placement
): React.CSSProperties {
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  if (placement === 'right') {
    const left = rect.right + SPOTLIGHT_PAD + GAP;
    const top = Math.max(16, Math.min(rect.top, vh - 280));

    // If it overflows viewport right, fall back to below the target
    if (left + TOOLTIP_W > vw - 16) {
      return {
        top: rect.bottom + SPOTLIGHT_PAD + GAP,
        left: Math.max(16, rect.left),
        width: TOOLTIP_W,
      };
    }
    return { top, left, width: TOOLTIP_W };
  }

  // center-top: float inside a large target area
  const left = Math.max(
    16,
    Math.min(rect.left + rect.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 16)
  );
  const top = Math.max(16, rect.top + 60);
  return { top, left, width: TOOLTIP_W };
}

/* ------------------------------------------------------------------ */
/*  Spotlight overlay                                                  */
/* ------------------------------------------------------------------ */

function OnboardingOverlay({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const Icon = step.icon;

  /* Measure target element, poll for layout shifts */
  const measure = useCallback(() => {
    const el = document.querySelector(
      `[data-onboarding="${step.target}"]`
    ) as HTMLElement | null;
    if (el) setTargetRect(el.getBoundingClientRect());
  }, [step.target]);

  useEffect(() => {
    measure();
    const id = setInterval(measure, 300);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  /* Scroll target into view on step change */
  useEffect(() => {
    const el = document.querySelector(
      `[data-onboarding="${step.target}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [step.target]);

  function handleNext() {
    if (isLast) onClose();
    else setStepIndex((i) => i + 1);
  }

  function handleBack() {
    if (!isFirst) setStepIndex((i) => i - 1);
  }

  if (!targetRect) return null;

  const spotlightRect = {
    top: targetRect.top - SPOTLIGHT_PAD,
    left: targetRect.left - SPOTLIGHT_PAD,
    width: targetRect.width + SPOTLIGHT_PAD * 2,
    height: targetRect.height + SPOTLIGHT_PAD * 2,
  };

  return createPortal(
    <>
      {/* Click-blocker behind everything */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      {/* Spotlight cutout — box-shadow darkens everything outside */}
      <div
        className="fixed rounded-xl pointer-events-none z-[9999]"
        style={{
          ...spotlightRect,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)',
        }}
      />

      {/* Ring highlight around target */}
      <div
        className="fixed rounded-xl pointer-events-none z-[9999] ring-2 ring-primary/50 ring-offset-2 ring-offset-transparent"
        style={{
          ...spotlightRect,
          transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)',
        }}
      />

      {/* Tooltip card */}
      <div
        className="fixed z-[10000]"
        style={computeTooltipStyle(targetRect, step.placement)}
      >
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xl animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <Icon className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Step {stepIndex + 1} of {STEPS.length}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Body */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-3">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStepIndex(i)}
                className={`size-1.5 rounded-full transition-colors ${
                  i === stepIndex
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="ghost"
              size="xs"
              onClick={handleBack}
              disabled={isFirst}
              className="gap-1"
            >
              <ChevronLeft className="size-3" />
              Back
            </Button>
            <Button size="xs" onClick={handleNext} className="gap-1">
              {isLast ? 'Done' : 'Next'}
              {!isLast && <ChevronRight className="size-3" />}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/*  Trigger button (exported for Sidebar)                              */
/* ------------------------------------------------------------------ */

export function OnboardingButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="size-3.5" />
        Quick Tour
      </Button>
      {mounted && open && <OnboardingOverlay onClose={() => setOpen(false)} />}
    </>
  );
}
