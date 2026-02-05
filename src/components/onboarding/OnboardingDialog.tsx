'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
} from 'lucide-react';

const STEPS = [
  {
    icon: Upload,
    title: 'Upload PDFs',
    description:
      'Drag and drop PDF files into the dropzone or click to browse. Each document will be processed to extract ideas.',
  },
  {
    icon: Sparkles,
    title: 'Extract Ideas',
    description:
      'Click "Extract Ideas" to run GPT-4 on your documents. The AI identifies key concepts, claims, and insights from the text.',
  },
  {
    icon: Link2,
    title: 'Link Ideas',
    description:
      'After extraction, ideas are automatically linked by semantic similarity. Relationships like "supports", "contradicts", and "extends" are created.',
  },
  {
    icon: Share2,
    title: 'Explore the Graph',
    description:
      'Pan and zoom the canvas to explore your knowledge graph. Nodes are grouped by source document and color-coded by relationship type.',
  },
  {
    icon: Search,
    title: 'Inspect Details',
    description:
      'Click any node or edge to open the inspector panel. View the full idea text, evidence excerpts, and jump to the original PDF location.',
  },
];

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingDialog({ open, onOpenChange }: OnboardingDialogProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const Icon = step.icon;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      onOpenChange(false);
      setStepIndex(0);
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function handleBack() {
    if (!isFirst) {
      setStepIndex((i) => i - 1);
    }
  }

  function handleClose() {
    onOpenChange(false);
    setStepIndex(0);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="flex-1">
              <DialogTitle>{step.title}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Step {stepIndex + 1} of {STEPS.length}
              </p>
            </div>
          </div>
        </DialogHeader>

        <DialogDescription className="text-sm leading-relaxed">
          {step.description}
        </DialogDescription>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStepIndex(i)}
              className={`size-2 rounded-full transition-colors ${
                i === stepIndex
                  ? 'bg-primary'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={isFirst}
            className="gap-1"
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
          <Button size="sm" onClick={handleNext} className="gap-1">
            {isLast ? 'Done' : 'Next'}
            {!isLast && <ChevronRight className="size-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OnboardingButton() {
  const [open, setOpen] = useState(false);

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
      <OnboardingDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
