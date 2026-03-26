import { useCallback, useMemo, useState } from "react";
import type { NormalizedPosition } from "./overlayConstants";
import {
  CENTER_POSITION,
  OVERLAY_SCALE_DEFAULT,
} from "./overlayConstants";

export type SlotTransformState = {
  position: NormalizedPosition;
  scale: number;
};

const initialSlot: SlotTransformState = {
  position: CENTER_POSITION,
  scale: OVERLAY_SCALE_DEFAULT,
};

export function cloneSlot(t: SlotTransformState): SlotTransformState {
  return {
    position: { ...t.position },
    scale: t.scale,
  };
}

function mergeSlot(
  base: SlotTransformState,
  partial: Partial<SlotTransformState>
): SlotTransformState {
  return {
    position: partial.position
      ? { ...partial.position }
      : { ...base.position },
    scale: partial.scale !== undefined ? partial.scale : base.scale,
  };
}

type Bundle = {
  past: SlotTransformState[];
  present: SlotTransformState;
  future: SlotTransformState[];
};

function slotEqual(a: SlotTransformState, b: SlotTransformState): boolean {
  return (
    a.scale === b.scale &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y
  );
}

export function useSlotTransformHistory() {
  const [bundle, setBundle] = useState<Bundle>(() => ({
    past: [],
    present: cloneSlot(initialSlot),
    future: [],
  }));

  const canUndo = bundle.past.length > 0;
  const canRedo = bundle.future.length > 0;

  const commit = useCallback((partial: Partial<SlotTransformState>) => {
    setBundle((s) => ({
      past: [...s.past, cloneSlot(s.present)],
      present: mergeSlot(s.present, partial),
      future: [],
    }));
  }, []);

  const patchPresent = useCallback((partial: Partial<SlotTransformState>) => {
    setBundle((s) => ({
      ...s,
      present: mergeSlot(s.present, partial),
    }));
  }, []);

  const recordCheckpoint = useCallback((snapshotBeforeGesture: SlotTransformState) => {
    setBundle((s) => {
      if (slotEqual(snapshotBeforeGesture, s.present)) return s;
      return {
        past: [...s.past, cloneSlot(snapshotBeforeGesture)],
        present: s.present,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setBundle((s) => {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1];
      return {
        past: s.past.slice(0, -1),
        present: cloneSlot(prev),
        future: [cloneSlot(s.present), ...s.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setBundle((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        past: [...s.past, cloneSlot(s.present)],
        present: cloneSlot(next),
        future: s.future.slice(1),
      };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setBundle((s) => ({
      ...s,
      past: [],
      future: [],
    }));
  }, []);

  return useMemo(
    () => ({
      present: bundle.present,
      commit,
      patchPresent,
      recordCheckpoint,
      undo,
      redo,
      canUndo,
      canRedo,
      clearHistory,
    }),
    [
      bundle.present,
      commit,
      patchPresent,
      recordCheckpoint,
      undo,
      redo,
      canUndo,
      canRedo,
      clearHistory,
    ]
  );
}
