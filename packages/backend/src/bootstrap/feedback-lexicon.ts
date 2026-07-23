import type { PolarityHint } from '@agent-deck/shared';

const NEGATIVE_MARKERS = ['no', "don't", 'do not', 'actually', 'instead', 'wrong', 'revert', 'undo', 'never', 'stop'];
const POSITIVE_MARKERS = ['perfect', 'works', 'great', 'ship it', 'lgtm', 'exactly'];

export type FeedbackMarkers = {
  markers: string[];
  polarityHint: PolarityHint;
};

function matchesMarker(text: string, marker: string): boolean {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

export function extractFeedbackMarkers(text: string): FeedbackMarkers {
  const negative = NEGATIVE_MARKERS.filter((marker) => matchesMarker(text, marker));
  const positive = POSITIVE_MARKERS.filter((marker) => matchesMarker(text, marker));

  return {
    markers: [...negative, ...positive],
    polarityHint:
      negative.length > 0 && positive.length > 0
        ? 'mixed'
        : negative.length > 0
          ? 'negative'
          : positive.length > 0
            ? 'positive'
            : 'unknown',
  };
}
