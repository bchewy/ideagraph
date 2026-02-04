import React from 'react';
import { Composition } from 'remotion';
import { IdeaGraphVideo } from './IdeaGraphVideo';
import {
  FPS,
  LANDSCAPE_WIDTH,
  LANDSCAPE_HEIGHT,
  SHORT_WIDTH,
  SHORT_HEIGHT,
  TOTAL_FRAMES,
} from './lib/constants';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="IdeaGraphLandscape"
        component={IdeaGraphVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={LANDSCAPE_WIDTH}
        height={LANDSCAPE_HEIGHT}
      />
      <Composition
        id="IdeaGraphShort"
        component={IdeaGraphVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={SHORT_WIDTH}
        height={SHORT_HEIGHT}
      />
    </>
  );
};
