import React from 'react';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { IntroScene } from './scenes/IntroScene';
import { UploadScene } from './scenes/UploadScene';
import { ExtractionScene } from './scenes/ExtractionScene';
import { GraphScene } from './scenes/GraphScene';
import { FocusInspectorScene } from './scenes/FocusInspectorScene';
import { OutroScene } from './scenes/OutroScene';

const FADE_DURATION = 15;

export const IdeaGraphVideo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={180}>
        <IntroScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        timing={linearTiming({ durationInFrames: FADE_DURATION })}
        presentation={fade()}
      />

      <TransitionSeries.Sequence durationInFrames={180}>
        <UploadScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        timing={linearTiming({ durationInFrames: FADE_DURATION })}
        presentation={fade()}
      />

      <TransitionSeries.Sequence durationInFrames={210}>
        <ExtractionScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        timing={linearTiming({ durationInFrames: FADE_DURATION })}
        presentation={fade()}
      />

      <TransitionSeries.Sequence durationInFrames={240}>
        <GraphScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        timing={linearTiming({ durationInFrames: FADE_DURATION })}
        presentation={fade()}
      />

      <TransitionSeries.Sequence durationInFrames={180}>
        <FocusInspectorScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        timing={linearTiming({ durationInFrames: FADE_DURATION })}
        presentation={fade()}
      />

      <TransitionSeries.Sequence durationInFrames={60}>
        <OutroScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
