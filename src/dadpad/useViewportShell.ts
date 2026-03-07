import { CSSProperties, useEffect, useMemo, useState } from "react";

type ViewportShellState = {
  isKeyboardOpen: boolean;
  shellStyle: CSSProperties;
};

type ViewportShellStyle = CSSProperties & {
  "--viewport-height"?: string;
  "--keyboard-inset"?: string;
};

const KEYBOARD_OPEN_THRESHOLD_PX = 120;

function readViewportMetrics() {
  if (typeof window === "undefined" || !window.visualViewport) {
    return {
      viewportHeight: null,
      keyboardInset: 0,
      isKeyboardOpen: false,
    };
  }

  const viewportHeight = Math.max(0, Math.round(window.visualViewport.height));
  const keyboardInset = Math.max(
    0,
    Math.round(window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop),
  );

  return {
    viewportHeight,
    keyboardInset,
    isKeyboardOpen: keyboardInset > KEYBOARD_OPEN_THRESHOLD_PX,
  };
}

export function useViewportShell(): ViewportShellState {
  const [metrics, setMetrics] = useState(readViewportMetrics);

  useEffect(() => {
    if (!window.visualViewport) {
      return;
    }

    const updateMetrics = () => {
      setMetrics(readViewportMetrics());
    };

    updateMetrics();
    window.visualViewport.addEventListener("resize", updateMetrics);
    window.visualViewport.addEventListener("scroll", updateMetrics);
    window.addEventListener("resize", updateMetrics);
    window.addEventListener("orientationchange", updateMetrics);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateMetrics);
      window.visualViewport?.removeEventListener("scroll", updateMetrics);
      window.removeEventListener("resize", updateMetrics);
      window.removeEventListener("orientationchange", updateMetrics);
    };
  }, []);

  const shellStyle = useMemo<CSSProperties>(() => {
    const style: ViewportShellStyle = {};

    if (metrics.viewportHeight !== null) {
      style["--viewport-height"] = `${metrics.viewportHeight}px`;
    }

    if (metrics.keyboardInset > 0) {
      style["--keyboard-inset"] = `${metrics.keyboardInset}px`;
    }

    return style;
  }, [metrics.keyboardInset, metrics.viewportHeight]);

  return {
    isKeyboardOpen: metrics.isKeyboardOpen,
    shellStyle,
  };
}
