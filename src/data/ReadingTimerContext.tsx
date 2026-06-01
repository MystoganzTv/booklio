/**
 * ReadingTimerContext
 *
 * Global reading session timer.
 * - start(bookId)  — starts the clock for a book
 * - stop()         — stops and returns elapsed minutes
 * - reset()        — clears state
 *
 * FloatingTimer component reads from this context and renders
 * a persistent bar above the tab bar whenever the timer is running.
 */
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type TimerState = {
  bookId: string | null;
  startedAt: number | null;   // Date.now() ms
  elapsedMs: number;          // accumulated ms (updates every second)
  isRunning: boolean;
};

type TimerContextValue = TimerState & {
  start: (bookId: string) => void;
  stop: () => number;          // returns elapsed minutes (rounded)
  reset: () => void;
};

const TimerContext = createContext<TimerContextValue | null>(null);

export function ReadingTimerProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<TimerState>({
    bookId: null,
    startedAt: null,
    elapsedMs: 0,
    isRunning: false,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every second
  useEffect(() => {
    if (state.isRunning && state.startedAt !== null) {
      intervalRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsedMs: Date.now() - (prev.startedAt ?? Date.now()),
        }));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isRunning, state.startedAt]);

  const start = useCallback((bookId: string) => {
    setState({
      bookId,
      startedAt: Date.now(),
      elapsedMs: 0,
      isRunning: true,
    });
  }, []);

  const stop = useCallback((): number => {
    const minutes = Math.max(1, Math.round(state.elapsedMs / 60_000));
    setState({ bookId: null, startedAt: null, elapsedMs: 0, isRunning: false });
    return minutes;
  }, [state.elapsedMs]);

  const reset = useCallback(() => {
    setState({ bookId: null, startedAt: null, elapsedMs: 0, isRunning: false });
  }, []);

  return (
    <TimerContext.Provider value={{ ...state, start, stop, reset }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useReadingTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useReadingTimer must be used inside ReadingTimerProvider");
  return ctx;
}

/** Format ms → "mm:ss" */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
