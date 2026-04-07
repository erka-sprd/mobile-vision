import React, { useEffect, useRef, useState } from "react";
import { ChevronUp, X } from "lucide-react";

const DEFAULT_COLOR = "softEcru";

const DRAWER_MIN = 70;
const HEADER = 56;
const EDITOR_MIN = 170;
const THRESHOLD = 10;

const colorSwatches = [
  { key: "violet", color: "#6b4f8e" },
  { key: "black", color: "#111111" },
  { key: "pinkjoy", color: "#c7849d" },
  { key: "mocha", color: "#d96a0c" },
  { key: "softEcru", color: "#ece8dc" },
  { key: "navyblue", color: "#1f2533" },
  { key: "heathergrey", color: "#5f79a8" },
  { key: "khaki", color: "#556331" },
  { key: "stone", color: "#c7ebe3" },
];

const colorHasCloseup = (key: string) => key !== "mocha";

const outOfStock: Record<string, string[]> = {
  khaki: ["XS", "3XL"],
  stone: ["2XL"],
};

const getSlidesForColor = (key: string) => [
  { label: "Front", src: `/img/product-images/${key}-front.png` },
  { label: "Back", src: `/img/product-images/${key}-back.png` },
  { label: "Left Arm", src: `/img/product-images/${key}-leftarm.png` },
  { label: "Right Arm", src: `/img/product-images/${key}-rightarm.png` },
  ...(colorHasCloseup(key) ? [{ label: "Close Up", src: `/img/product-images/${key}-closeup.png` }] : []),
];

 export default function App() {
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const slides = getSlidesForColor(selectedColor);
  const [height, setHeight] = useState(DRAWER_MIN);
  const [maxH, setMaxH] = useState(DRAWER_MIN);
  const [expanded, setExpanded] = useState(false);
  const [index, setIndex] = useState(0);
  const [showSlideLabel, setShowSlideLabel] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [atScrollBottom, setAtScrollBottom] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">(
    "right"
  );
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const drag = useRef({
    startY: 0,
    startH: DRAWER_MIN,
    active: false,
  });

  const handlePathRef = useRef<SVGPathElement>(null);
  const handleSvgRef = useRef<SVGSVGElement>(null);

  const barScrollRef = useRef<HTMLDivElement>(null);
  const addDesignBtnRef = useRef<HTMLButtonElement>(null);
  const [barScrollProgress, setBarScrollProgress] = useState(0);
  const addDesignExpandedWidth = useRef<number | null>(null);
  const addDesignCurrentWidth = useRef<number | null>(null);
  const addDesignAnimRef = useRef<number | null>(null);
  const isBarCompactRef = useRef(false);
  const isBarAnimatingRef = useRef(false);

  const COMPACT_WIDTH = 54;
  const ANIM_DURATION = 500;

  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

  const animateAddDesignWidth = (fromWidth: number, toWidth: number) => {
    const btn = addDesignBtnRef.current;
    const scroll = barScrollRef.current;
    if (!btn || !scroll) return;
    if (addDesignAnimRef.current !== null) cancelAnimationFrame(addDesignAnimRef.current);
    isBarAnimatingRef.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / ANIM_DURATION, 1);
      const w = fromWidth + (toWidth - fromWidth) * easeOut(t);
      const paddingW = fromWidth + (toWidth - fromWidth) * easeOut(t);
      btn.style.width = `${w}px`;
      addDesignCurrentWidth.current = w;
      scroll.style.paddingLeft = `${16 + paddingW + 8}px`;
      if (t < 1) {
        addDesignAnimRef.current = requestAnimationFrame(tick);
      } else {
        addDesignAnimRef.current = null;
        isBarAnimatingRef.current = false;
      }
    };
    addDesignAnimRef.current = requestAnimationFrame(tick);
  };

  const handleBarScroll = () => {
    const el = barScrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const progress = max > 0 ? el.scrollLeft / max : 0;
    setBarScrollProgress(progress);
    if (isBarAnimatingRef.current) return;
    const btn = addDesignBtnRef.current;
    if (!btn) return;
    const shouldBeCompact = progress > 0;
    if (shouldBeCompact === isBarCompactRef.current) return;
    isBarCompactRef.current = shouldBeCompact;
    if (shouldBeCompact) {
      addDesignExpandedWidth.current = btn.offsetWidth;
      animateAddDesignWidth(btn.offsetWidth, COMPACT_WIDTH);
    } else {
      const expandedWidth = addDesignExpandedWidth.current ?? btn.offsetWidth;
      animateAddDesignWidth(addDesignCurrentWidth.current ?? COMPACT_WIDTH, expandedWidth);
    }
  };

  useEffect(() => {
    const btn = addDesignBtnRef.current;
    const scroll = barScrollRef.current;
    if (!btn || !scroll) return;
    const w = btn.offsetWidth;
    addDesignExpandedWidth.current = w;
    addDesignCurrentWidth.current = w;
    scroll.style.paddingLeft = `${16 + w + 8}px`;
  }, []);
  const chevronState = useRef({ bend: 0, gray: 0.8, scale: 1, rafId: 0 });
  const dragDirection = useRef<"up" | "down" | "none">("none");

  useEffect(() => {
    const cs = chevronState.current;
    const animate = () => {
      const targetBend = dragging
        ? dragDirection.current === "up" ? -3 : dragDirection.current === "down" ? 3 : 0
        : 0;
      const targetGray = dragging ? 0 : 0.8;
      const targetScale = dragging ? 2 : 1;
      cs.bend += (targetBend - cs.bend) * 0.12;
      cs.gray += (targetGray - cs.gray) * 0.1;
      cs.scale += (targetScale - cs.scale) * 0.1;
      if (handlePathRef.current) {
        const g = Math.round(cs.gray * 255);
        handlePathRef.current.setAttribute("d", `M0,2 Q18,${(2 + cs.bend).toFixed(2)} 36,2`);
        handlePathRef.current.setAttribute("stroke", `rgb(${g},${g},${g})`);
      }
      if (handleSvgRef.current) {
        handleSvgRef.current.style.transform = `scale(${cs.scale.toFixed(3)}, 1)`;
      }
      if (Math.abs(targetBend - cs.bend) > 0.02 || Math.abs(targetGray - cs.gray) > 0.005 || Math.abs(targetScale - cs.scale) > 0.005) {
        cs.rafId = requestAnimationFrame(animate);
      } else if (handlePathRef.current) {
        handlePathRef.current.setAttribute("d", `M0,2 Q18,${(2 + targetBend).toFixed(2)} 36,2`);
        handlePathRef.current.setAttribute("stroke", `rgb(${Math.round(targetGray * 255)},${Math.round(targetGray * 255)},${Math.round(targetGray * 255)})`);
        if (handleSvgRef.current) handleSvgRef.current.style.transform = `scale(${targetScale}, 1)`;
      }
    };
    cs.rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(cs.rafId);
  }, [dragging]);

  const scrollGesture = useRef({
    startY: 0,
    startScrollTop: 0,
    draggingSheet: false,
    lockedAtTop: false,
  });

  const horizontalGesture = useRef({
    startX: 0,
    startY: 0,
    locked: false,
  });

  const imageGesture = useRef({
    mode: "idle" as "idle" | "pinch" | "pan",
    startDistance: 0,
    startZoom: 1,
    startPan: { x: 0, y: 0 },
    startCenter: { x: 0, y: 0 },
    startTouch: { x: 0, y: 0 },
    lastPan: { x: 0, y: 0 },
    lastZoom: 1,
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const imageNaturalSizeRef = useRef({ width: 1, height: 1 });

  useEffect(() => {
    const prevBodyMargin = document.body.style.margin;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevHtmlOverscroll =
      document.documentElement.style.overscrollBehavior;

    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    const madeId = "made-outer-sans-font";
    if (!document.getElementById(madeId)) {
      const style = document.createElement("style");
      style.id = madeId;
      style.textContent = `
        @font-face {
          font-family: "MADEOuterSans";
          src: url("/fonts/MADE-Outer-Sans-Medium.woff2") format("woff2"),
               url("/fonts/MADE-Outer-Sans-Medium.otf") format("opentype");
          font-weight: 500;
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      document.body.style.margin = prevBodyMargin;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, []);

  useEffect(() => {
    const updateMaxHeight = () => {
      const nextMax = Math.max(
        DRAWER_MIN,
        window.innerHeight - HEADER - EDITOR_MIN + 30
      );
      setMaxH(nextMax);
      setHeight((prev) => Math.min(Math.max(DRAWER_MIN, prev), nextMax));
    };

    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);


  useEffect(() => {
    setShowSlideLabel(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    imageGesture.current.lastZoom = 1;
    imageGesture.current.lastPan = { x: 0, y: 0 };
    const timeout = window.setTimeout(() => {
      setShowSlideLabel(false);
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [index]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = e.touches[0].clientY - startY;
      const isVertical = Math.abs(dy) > dx;
      if (!isVertical) return;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((atTop && dy > 0) || (atBottom && dy < 0)) e.preventDefault();
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
    };
  }, []);

  useEffect(() => {
    if (phase !== "out" || targetIndex === null) return;

    const outTimer = window.setTimeout(() => {
      setActiveIndex(targetIndex);
      setPhase("in");
    }, 180);

    return () => window.clearTimeout(outTimer);
  }, [phase, targetIndex]);

  useEffect(() => {
    if (phase !== "in") return;

    const raf1 = window.requestAnimationFrame(() => {
      const raf2 = window.requestAnimationFrame(() => {
        const settleTimer = window.setTimeout(() => {
          setPhase("idle");
          setTargetIndex(null);
        }, 180);

        return () => window.clearTimeout(settleTimer);
      });

      return () => window.cancelAnimationFrame(raf2);
    });

    return () => window.cancelAnimationFrame(raf1);
  }, [phase]);

  const shadow = expanded
    ? "0 -20px 60px rgba(0,0,0,0.14), 0 -4px 16px rgba(0,0,0,0.07)"
    : "0 -8px 32px rgba(0,0,0,0.08), 0 -2px 8px rgba(0,0,0,0.04)";

  const start = (y: number) => {
    drag.current = {
      startY: y,
      startH: drawerRef.current?.offsetHeight || DRAWER_MIN,
      active: false,
    };
    setDragging(false);
  };

  const move = (y: number) => {
    const d = drag.current;
    const dy = d.startY - y;

    if (!d.active && Math.abs(dy) > THRESHOLD) {
      d.active = true;
      setDragging(true);
    }

    if (!d.active) return;

    dragDirection.current = dy > 0 ? "up" : "down";
    const next = Math.min(maxH, Math.max(DRAWER_MIN, d.startH + dy));
    setHeight(next);
  };

  const end = (y: number) => {
    const d = drag.current;
    if (!d.active) return;

    const dy = d.startY - y;
    const midpoint = DRAWER_MIN + (maxH - DRAWER_MIN) / 2;
    const nextExpanded =
      dy > THRESHOLD ? true : dy < -THRESHOLD ? false : height > midpoint;

    setExpanded(nextExpanded);
    setHeight(nextExpanded ? maxH : DRAWER_MIN);
    setDragging(false);
    dragDirection.current = "none";
    d.active = false;
  };

  const bindMouse = () => (e: React.MouseEvent) => {
    start(e.clientY);

    const mm = (ev: MouseEvent) => move(ev.clientY);
    const mu = (ev: MouseEvent) => {
      end(ev.clientY);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };

    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
  };

  const bindTouchStart = () => (e: React.TouchEvent) => {
    start(e.touches[0].clientY);
  };

  const bindTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    move(e.touches[0].clientY);
  };

  const bindTouchEnd = (e: React.TouchEvent) => {
    end(e.changedTouches[0].clientY);
  };

  const onScrollTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const scrollTop = scrollRef.current?.scrollTop || 0;
    const atTop = scrollTop <= 0;

    scrollGesture.current = {
      startY: e.touches[0].clientY,
      startScrollTop: scrollTop,
      draggingSheet: false,
      lockedAtTop: expanded && atTop,
    };

    if (!expanded) {
      start(e.touches[0].clientY);
      scrollGesture.current.draggingSheet = true;
    }
  };

  const onScrollTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - scrollGesture.current.startY;
    const pullingDown = deltaY > THRESHOLD;
    const atTop = scrollEl.scrollTop <= 0;

    if (expanded && atTop) {
      scrollEl.scrollTop = 0;
    }

    if (!scrollGesture.current.draggingSheet) {
      const shouldDragSheet =
        !expanded ||
        ((scrollGesture.current.lockedAtTop ||
          scrollGesture.current.startScrollTop <= 0) &&
          atTop &&
          pullingDown);

      if (shouldDragSheet) {
        e.preventDefault();
        scrollEl.scrollTop = 0;
        start(scrollGesture.current.startY);
        scrollGesture.current.draggingSheet = true;
      }
    }

    if (scrollGesture.current.draggingSheet) {
      e.preventDefault();
      scrollEl.scrollTop = 0;
      move(currentY);
    }
  };

  const onScrollTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (scrollGesture.current.draggingSheet) {
      end(e.changedTouches[0].clientY);
    }

    scrollGesture.current.draggingSheet = false;
    scrollGesture.current.lockedAtTop = false;
  };

  const onScrollMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (expanded) return;

    start(e.clientY);

    const mm = (ev: MouseEvent) => move(ev.clientY);
    const mu = (ev: MouseEvent) => {
      end(ev.clientY);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };

    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
  };

  const onHorizontalTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    horizontalGesture.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      locked: false,
    };
  };

  const onHorizontalTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const dx = e.touches[0].clientX - horizontalGesture.current.startX;
    const dy = e.touches[0].clientY - horizontalGesture.current.startY;

    if (
      !horizontalGesture.current.locked &&
      Math.abs(dx) > THRESHOLD &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      horizontalGesture.current.locked = true;
    }

    if (horizontalGesture.current.locked) {
      e.stopPropagation();
    }
  };

  const onHorizontalTouchEnd = () => {
    horizontalGesture.current.locked = false;
  };

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;

    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 };

    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const clampZoom = (value: number) => {
    return Math.max(1, Math.min(3, value));
  };

  const getPanLimits = (nextZoom: number) => {
    const editorEl = editorRef.current;
    if (!editorEl || nextZoom <= 1) {
      return { x: 0, y: 0 };
    }

    const editorWidth = editorEl.clientWidth || 1;
    const editorHeight = editorEl.clientHeight || 1;
    const imageWidth = imageNaturalSizeRef.current.width || 1;
    const imageHeight = imageNaturalSizeRef.current.height || 1;
    const containScale = Math.min(
      editorWidth / imageWidth,
      editorHeight / imageHeight
    );
    const baseWidth = imageWidth * containScale;
    const baseHeight = imageHeight * containScale;
    const maxX = Math.max(0, (baseWidth * nextZoom - baseWidth) / 2);
    const maxY = Math.max(0, (baseHeight * nextZoom - baseHeight) / 2);

    return { x: maxX, y: maxY };
  };

  const clampPan = (nextPan: { x: number; y: number }, nextZoom: number) => {
    if (nextZoom <= 1) {
      return { x: 0, y: 0 };
    }

    const limits = getPanLimits(nextZoom);

    return {
      x: Math.max(-limits.x, Math.min(limits.x, nextPan.x)),
      y: Math.max(-limits.y, Math.min(limits.y, nextPan.y)),
    };
  };

  const onEditorTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      if (zoom <= 1) {
        setPan({ x: 0, y: 0 });
      }

      imageGesture.current = {
        mode: "pinch",
        startDistance: getTouchDistance(e.touches),
        startZoom: zoom,
        startPan: zoom <= 1 ? { x: 0, y: 0 } : pan,
        startCenter: getTouchCenter(e.touches),
        startTouch: { x: 0, y: 0 },
        lastPan: zoom <= 1 ? { x: 0, y: 0 } : pan,
        lastZoom: zoom,
      };
      return;
    }

    if (e.touches.length === 1 && zoom > 1) {
      imageGesture.current = {
        mode: "pan",
        startDistance: 0,
        startZoom: zoom,
        startPan: pan,
        startCenter: { x: 0, y: 0 },
        startTouch: {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        },
        lastPan: pan,
        lastZoom: zoom,
      };
    }
  };

  const onEditorTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (imageGesture.current.mode === "pinch") {
      if (e.touches.length !== 2) return;
      e.preventDefault();

      const nextDistance = getTouchDistance(e.touches);
      if (!imageGesture.current.startDistance) return;

      const scaleFactor = nextDistance / imageGesture.current.startDistance;
      const nextZoom = clampZoom(imageGesture.current.startZoom * scaleFactor);
      const center = getTouchCenter(e.touches);
      const centerDx = center.x - imageGesture.current.startCenter.x;
      const centerDy = center.y - imageGesture.current.startCenter.y;

      let nextPan = clampPan(
        {
          x: imageGesture.current.startPan.x + centerDx,
          y: imageGesture.current.startPan.y + centerDy,
        },
        nextZoom
      );

      if (nextZoom <= 1) {
        nextPan = { x: 0, y: 0 };
      }

      imageGesture.current.lastZoom = nextZoom;
      imageGesture.current.lastPan = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
      return;
    }

    if (imageGesture.current.mode === "pan") {
      if (e.touches.length !== 1 || imageGesture.current.lastZoom <= 1) return;
      e.preventDefault();

      const dx = e.touches[0].clientX - imageGesture.current.startTouch.x;
      const dy = e.touches[0].clientY - imageGesture.current.startTouch.y;

      const nextPan = clampPan(
        {
          x: imageGesture.current.startPan.x + dx,
          y: imageGesture.current.startPan.y + dy,
        },
        imageGesture.current.lastZoom
      );

      imageGesture.current.lastPan = nextPan;
      setPan(nextPan);
    }
  };

  const onEditorTouchEnd = () => {
    imageGesture.current.mode = "idle";

    if (imageGesture.current.lastZoom <= 1) {
      imageGesture.current.lastZoom = 1;
      imageGesture.current.lastPan = { x: 0, y: 0 };
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const goToSlide = (nextIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(slides.length - 1, nextIndex));
    if (clampedIndex === activeIndex || phase !== "idle") return;

    setSlideDirection(clampedIndex > activeIndex ? "right" : "left");
    setTargetIndex(clampedIndex);
    setIndex(clampedIndex);
    setPhase("out");
  };

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: '"Inter Variable", sans-serif',
        background: "linear-gradient(300deg, #eaeaea 0%, #e3e3e3 100%)",
        overscrollBehavior: "none",
        touchAction: "manipulation",
      }}
    >
      {/* Orange banner */}
      <div style={{ background: "#E8502A", color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, flexShrink: 0 }}>
        Winter Sale 20%
        <img src="/icons/icon-chevrons-right.svg" alt="" style={{ width: 16, height: 16, filter: "invert(1)" }} />
      </div>

      <div
        style={{
          position: "absolute",
          top: 42,
          left: 8,
          right: 8,
          height: HEADER,
          borderRadius: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          zIndex: 10,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          background: "rgba(235, 235, 235, 0.5)",
          border: "1px solid #d8d8d8",
        }}
      >
        {/* Left: Undo + Redo */}
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 6px", cursor: "pointer" }}>
            <img src="/icons/icon-arrow-return-back.svg" alt="Undo" style={{ width: 22, height: 22 }} />
            <span style={{ fontSize: 10, color: "#989898", fontWeight: 500 }}>Undo</span>
          </button>
          <button type="button" style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 6px", cursor: "pointer" }}>
            <img src="/icons/icon-arrow-forward.svg" alt="Redo" style={{ width: 22, height: 22 }} />
            <span style={{ fontSize: 10, color: "#989898", fontWeight: 500 }}>Redo</span>
          </button>
        </div>

        {/* Center: Logo */}
        <img src="/icons/Logo.svg" alt="Spreadshirt" style={{ height: 24, objectFit: "contain" }} />

        {/* Right: Basket + Dots */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button type="button" style={{ background: "none", border: "none", padding: 6, cursor: "pointer", display: "flex" }}>
            <img src="/icons/icon-basket.svg" alt="Basket" style={{ width: 24, height: 24 }} />
          </button>
          <button type="button" style={{ background: "none", border: "none", padding: 6, cursor: "pointer", display: "flex" }}>
            <img src="/icons/icon-dots-horizontal.svg" alt="Menu" style={{ width: 24, height: 24 }} />
          </button>
        </div>
      </div>

      <div
        ref={editorRef}
        onTouchStart={onEditorTouchStart}
        onTouchMove={onEditorTouchMove}
        onTouchEnd={onEditorTouchEnd}
        style={{
          flex: 1,
          minHeight: EDITOR_MIN,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          touchAction: "none",
          background: "linear-gradient(300deg, #eaeaea 0%, #e3e3e3 100%)",
          paddingTop: expanded ? HEADER + 10 : 0,
          transition: "padding-top 0.7s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {slides.map((slide, slideIdx) => {
            const isActive = slideIdx === activeIndex;
            const isTarget = targetIndex !== null && slideIdx === targetIndex;
            const shouldRender = isActive || isTarget;

            if (!shouldRender) return null;

            let opacity = 0;
            let transform = "translate3d(0,0,0)";
            let zIndex = isTarget ? 1 : 0;
            let visibility: "visible" | "hidden" = "visible";

            if (isActive) {
              if (phase === "out") {
                opacity = 0;
                transform = `translate3d(${
                  slideDirection === "right" ? 24 : -24
                }px,0,0)`;
              } else if (phase === "in") {
                opacity = 1;
                transform = "translate3d(0,0,0)";
              } else {
                opacity = 1;
                transform = "translate3d(0,0,0)";
              }
            }

            if (isTarget) {
              if (phase === "out") {
                opacity = 0;
                visibility = "hidden";
                transform = `translate3d(${
                  slideDirection === "right" ? 24 : -24
                }px,0,0)`;
              } else if (phase === "in") {
                opacity = 1;
                visibility = "visible";
                transform = "translate3d(0,0,0)";
              }
            }

            return (
              <img
                onLoad={(e) => {
                  const img = e.currentTarget;
                  imageNaturalSizeRef.current = {
                    width: img.naturalWidth || 1,
                    height: img.naturalHeight || 1,
                  };
                }}
                key={slide.label}
                src={slide.src}
                alt={slide.label}
                draggable={false}
                style={{
                  position: "absolute",
                  inset: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  transformOrigin: "center center",
                  opacity,
                  visibility,
                  transform: `${transform} translate3d(${
                    zoom <= 1 ? 0 : pan.x
                  }px, ${zoom <= 1 ? 0 : pan.y}px, 0) scale(${zoom})`,
                  zIndex,
                  transition: "opacity 180ms ease-in-out",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  WebkitTransform: `${transform} translate3d(${
                    zoom <= 1 ? 0 : pan.x
                  }px, ${zoom <= 1 ? 0 : pan.y}px, 0) scale(${zoom})`,
                  willChange: "opacity, transform",
                  pointerEvents: "none",
                }}
              />
            );
          })}
        </div>

        {/* Button row — inside editor, overlays t-shirt */}
        <div id="editor-button-bar" style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10 }}>
          <div id="editor-button-bar-padding" style={{ paddingTop: 12, paddingBottom: 12 }}>
          <div
            id="editor-button-bar-scroll"
            ref={barScrollRef}
            onScroll={handleBarScroll}
            onTouchStart={onHorizontalTouchStart}
            onTouchMove={onHorizontalTouchMove}
            onTouchEnd={onHorizontalTouchEnd}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              overflowX: "auto",
              overflowY: "visible",
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              marginTop: -10,
              marginBottom: -10,
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-x",
            }}
          >
          <button type="button" style={{ height: 46, padding: "0 16px", borderRadius: 999, border: "none", background: "#F4F4F4", color: "#000", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, flexShrink: 0, boxShadow: "0 1px 9px rgba(0,0,0,0.03)" }}>
            <span>Front</span>
            <img src="/icons/icon-chevron-down.svg" width={16} height={16} alt="" />
          </button>
          <button type="button" style={{ height: 46, padding: "2px 16px 2px 4px", borderRadius: 999, border: "none", background: "#F4F4F4", color: "#000", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, flexShrink: 0, boxShadow: "0 1px 9px rgba(0,0,0,0.03)" }}>
            <img src="/img/preview.png" width={38} height={38} alt="" style={{ borderRadius: 999, display: "block" }} />
            <span>Preview</span>
          </button>
          <button type="button" style={{ height: 46, padding: "2px 16px 2px 4px", borderRadius: 999, border: "none", background: "#F4F4F4", color: "#000", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, flexShrink: 0, boxShadow: "0 1px 9px rgba(0,0,0,0.03)" }}>
            <img src="/icons/embroidery.png" width={38} height={38} alt="" style={{ borderRadius: 999, display: "block" }} />
            <span>Embroidery</span>
            <img src="/icons/icon-chevron-down.svg" width={16} height={16} alt="" />
          </button>
          <button type="button" style={{ height: 46, padding: "0 16px 0 4px", borderRadius: 999, border: "none", background: "#F4F4F4", color: "#000", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, flexShrink: 0, boxShadow: "0 1px 9px rgba(0,0,0,0.03)" }}>
            <img src="/icons/products.png" width="auto" height={40} alt="" style={{ marginTop: -2 }} />
            <span>Change product</span>
          </button>          
          <button type="button" style={{ height: 46, padding: "0 16px", borderRadius: 999, border: "none", background: "#F4F4F4", color: "#000", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, flexShrink: 0, boxShadow: "0 1px 9px rgba(0,0,0,0.03)" }}>
            <img src="/icons/icon-share.svg" width={18} height={18} alt="" />
            <span>Share</span>
          </button>
          <button type="button" style={{ height: 46, padding: "0 16px", borderRadius: 999, border: "none", background: "#F4F4F4", color: "#000", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, flexShrink: 0, boxShadow: "0 1px 9px rgba(0,0,0,0.03)" }}>
            <img src="/icons/icon-heart.svg" width={18} height={18} alt="" />
            <span>Save</span>
          </button>
          <div style={{ width: 4, flexShrink: 0 }} />
          </div>
          </div>
          <button
            id="editor-add-design-btn"
            ref={addDesignBtnRef}
            type="button"
            style={{
              position: "absolute",
              left: 16,
              top: barScrollProgress > 0 ? -62 : 12,
              height: barScrollProgress > 0 ? 54 : 46,
              padding: barScrollProgress > 0 ? "0" : "0 18px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(90deg, #DC2626 -0.88%, #4D52D2 49.94%, #16A34A 101.36%)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              flexShrink: 0,
              boxShadow: barScrollProgress > 0 ? "0 4px 16px rgba(0,0,0,0.35)" : "0 4px 14px rgba(0,0,0,0.2)",
              overflow: "hidden",
              boxSizing: "border-box",
              whiteSpace: "nowrap",
              zIndex: 2,
              transition: "top 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}><path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
            <span style={{ opacity: barScrollProgress > 0 ? 0 : 1, transition: "opacity 0.15s ease", ...(barScrollProgress > 0 ? { position: "absolute", left: 38 } : {}) }}>Add</span>
          </button>
        </div>

      </div>

      <div
        ref={drawerRef}
        data-drawer-zone="true"
        style={{
          height,
          background: "#F4F4F4",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          boxShadow: shadow,
          display: "flex",
          flexDirection: "column",
          transition: dragging
            ? "none"
            : "height 0.7s cubic-bezier(0.16,1,0.3,1)",
          overscrollBehavior: "none",
          touchAction: "manipulation",
          position: "relative",
        }}
      >
        <div
          onMouseDown={bindMouse()}
          onTouchStart={bindTouchStart()}
          onTouchMove={bindTouchMove}
          onTouchEnd={bindTouchEnd}
          style={{
            height: 20,
            touchAction: "none",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "grab",
          }}
        >
          <svg ref={handleSvgRef} width="36" height="8" viewBox="0 0 36 4" style={{ overflow: "visible" }}>
            <path
              ref={handlePathRef}
              d="M0,2 Q18,2 36,2"
              stroke="rgb(204,204,204)"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>

        <div
          ref={scrollRef}
          data-drawer-zone="true"
          onMouseDown={onScrollMouseDown}
          onTouchStart={onScrollTouchStart}
          onTouchMove={onScrollTouchMove}
          onTouchEnd={onScrollTouchEnd}
          onScroll={(e) => {
            const el = e.currentTarget;
            setAtScrollBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
          }}
          style={{
            flex: 1,
            overflowY: expanded ? "auto" : "hidden",
            padding: 0,
            paddingBottom: expanded ? 36 : 0,
            color: "#111",
            overscrollBehavior: "none",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            overscrollBehaviorY: "contain",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 + Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN))) * 2 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 20px",
                gap: 0,
              }}
            >
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                overflow: "hidden",
                flexShrink: 0,
                maxWidth: `${(1 - Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN)))) * 200}px`,
                marginRight: `${(1 - Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN)))) * 8}px`,
                opacity: 1 - Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN))),
                transition: "max-width 0.3s ease, margin-right 0.3s ease, opacity 0.3s ease",
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#000", flexShrink: 0, opacity: 0.7 }}>17,98 €</span>
                <span style={{ fontSize: 20, color: "#000", flexShrink: 0, opacity: 0.4, lineHeight: 1 }}>·</span>
              </div>
              <h2
                style={{
                  margin: 0,
                  fontFamily: "MADEOuterSans, sans-serif",
                  fontSize: 14,
                  lineHeight: 1.4,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: "#000",
                  opacity: 0.4 + Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN))) * 0.4,
                  flex: 1,
                  overflow: "hidden",
                  whiteSpace: height <= DRAWER_MIN + 5 ? "nowrap" : "normal",
                  textOverflow: height <= DRAWER_MIN + 5 ? "ellipsis" : "clip",
                  maxHeight: `${19.6 + Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN))) * 19.6}px`,
                }}
              >
                Men’s Premium Organic T-Shirt Stanley/Stella Oversized
              </h2>

              <button
                type="button"
                aria-label="Collapse drawer"
                onClick={() => {
                  if (expanded) {
                    setExpanded(false);
                    setHeight(DRAWER_MIN);
                  } else {170
                    setExpanded(true);
                    setHeight(maxH);
                  }
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: "none",
                  background: "#E9E9E9",
                  color: "#6A6A6A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  flexShrink: 0,
                  marginLeft: 12,
                }}
              >
                <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ position: "absolute", display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.2s, transform 0.2s", opacity: expanded ? 0 : 1, transform: expanded ? "scale(0.6)" : "scale(1)" }}>
                    <ChevronUp size={16} strokeWidth={2.25} />
                  </span>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.2s, transform 0.2s", opacity: expanded ? 1 : 0, transform: expanded ? "scale(1)" : "scale(0.6)" }}>
                    <X size={16} strokeWidth={2.25} />
                  </span>
                </span>
              </button>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              paddingLeft: 20,
              overflow: "hidden",
              maxHeight: `${Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN))) * 40}px`,
              marginTop: `${(1 - Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN)))) * -12}px`,
              opacity: Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN))),
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#EA580C" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#6A6A6A", letterSpacing: "-0.01em" }}>4.4 (1506 reviews)</span>
            </div>

            <div style={{ height: 1, background: "#E5E5E5", opacity: Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN))), maxHeight: `${Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN)))}px`, marginTop: `${(1 - Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN)))) * -12}px` }} />

            <div>
              <div
                style={{
                  marginBottom: `${Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN))) * 12}px`,
                  fontSize: 12,
                  lineHeight: 1.1,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "#111",
                  textTransform: "uppercase",
                  paddingLeft: 20,
                  overflow: "hidden",
                  maxHeight: `${Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN))) * 40}px`,
                  opacity: Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN))),
                }}
              >
                COLOR: {selectedColor.toUpperCase()}
              </div>

              <div
                onTouchStart={onHorizontalTouchStart}
                onTouchMove={onHorizontalTouchMove}
                onTouchEnd={onHorizontalTouchEnd}
                data-area="product color selection"
                style={{
                  display: "flex",
                  gap: 4,
                  overflowX: "auto",
                  paddingBottom: 4,
                  paddingLeft: 20,
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling: "touch",
                  touchAction: expanded ? "auto" : "pan-x",
                }}
              >
                {colorSwatches.map((swatch) => (
                  <button
                    key={swatch.key}
                    type="button"
                    aria-label={swatch.key}
                    onClick={() => { setSelectedColor(swatch.key); setIndex(0); }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      border: swatch.key === selectedColor ? "1px solid #000" : "2px solid transparent",
                      background: swatch.key === selectedColor ? "#fff" : "none",
                      padding: 4,
                      flexShrink: 0,
                      boxSizing: "border-box",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={`/img/product-images/${swatch.key}-front.png`}
                      alt={swatch.key}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: 8,
                        display: "block",
                      }}
                    />
                  </button>
                ))}
                <div style={{ width: 6, flexShrink: 0 }} />
              </div>
            </div>

            <div style={{ height: 1, background: "#E5E5E5", opacity: Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN))), maxHeight: `${Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN)))}px`, marginTop: `${(1 - Math.min(1, Math.max(0, (height - DRAWER_MIN) / (maxH - DRAWER_MIN)))) * -12}px` }} />

            <div>
              <div
                onTouchStart={onHorizontalTouchStart}
                onTouchMove={onHorizontalTouchMove}
                onTouchEnd={onHorizontalTouchEnd}
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingBottom: 4,
                  paddingLeft: 20,
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling: "touch",
                  touchAction: expanded ? "auto" : "pan-x",
                }}
              >
                {["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((size) => {
                  const disabled = outOfStock[selectedColor]?.includes(size) ?? false;
                  return (
                  <button
                    key={size}
                    type="button"
                    disabled={disabled}
                    style={{
                      height: 40,
                      minWidth: 48,
                      padding: "0 14px",
                      borderRadius: 8,
                      border: "1px solid #d9d9d9",
                      background: "#fff",
                      color: disabled ? "#ccc" : "#111",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: disabled ? "not-allowed" : "pointer",
                      flexShrink: 0,
                      textDecoration: disabled ? "line-through" : "none",
                    }}
                  >
                    {size}
                  </button>
                );})}
                <div style={{ width: 16, flexShrink: 0 }} />
              </div>
            </div>

            

            <div style={{ padding: "0 20px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#000" }}>17,98 €</div>
                <div style={{ fontSize: 14, fontWeight: 400, color: "#6A6A6A" }}>Plus shipping</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 400, color: "#000" }}>See price details</div>
            </div>

            <div style={{ padding: "0 20px", position: "sticky", top: 0, background: "#F4F4F4", paddingTop: 12, paddingBottom: 12, zIndex: 2 }}>
              <button
                type="button"
                style={{
                  width: "100%",
                  height: 54,
                  borderRadius: 999,
                  border: "none",
                  background: "#000",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <img src="/icons/icon-basket.svg" alt="" style={{ width: 20, height: 20, filter: "invert(1)" }} />
                <span>Add to basket</span>
              </button>
            </div>

            {/* Shipping info */}
            <div style={{ margin: "16px 16px 0", border: "1px solid #dedede", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <img src="/icons/icon-truck.svg" alt="" style={{ width: 24, height: 24, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
                    <span style={{ fontSize: 14, color: "#3a8a3a", fontWeight: 500 }}>Express</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>06 Apr – 08 Apr</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, color: "#111" }}>Standard</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>13 Apr – 15 Apr</span>
                  </div>
                  <span style={{ fontSize: 14, color: "#111", textDecoration: "underline", cursor: "pointer" }}>See options</span>
                </div>
              </div>
              <div style={{ height: 1, background: "#dedede", margin: "0 16px" }} />
              <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
                <img src="/icons/icon-refresh.svg" alt="" style={{ width: 24, height: 24, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: "#111", textDecoration: "underline", cursor: "pointer" }}>30-day return guarantee</span>
              </div>
            </div>

            {/* Accordions */}
            <div style={{ margin: "0 16px", border: "1px solid #dedede", borderRadius: 12, overflow: "hidden" }}>
              {[
                { key: "product-details", label: "Product details", content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." },
                { key: "size-fit", label: "Size & fit", content: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat." },
                { key: "product-reviews", label: "Product reviews", extra: (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    {[1,2,3,4].map(i => <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#EA580C"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <span style={{ fontSize: 14, color: "#111" }}>4.5 (128 reviews)</span>
                  </div>
                ), content: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur." },
              ].map(({ key, label, content, extra }, i) => (
                <div key={key} style={{ borderTop: i === 0 ? "none" : "1px solid #dedede" }}>
                  <button
                    type="button"
                    onClick={() => setOpenAccordion(openAccordion === key ? null : key)}
                    style={{ width: "100%", background: "none", border: "none", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                  >
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 16, fontWeight: 500, color: "#111" }}>{label}</div>
                      {openAccordion !== key && extra}
                    </div>
                    <img src="/icons/icon-chevron-down.svg" alt="" style={{ width: 20, height: 20, filter: "invert(20%)", flexShrink: 0, transition: "transform 0.2s", transform: openAccordion === key ? "rotate(180deg)" : "none" }} />
                  </button>
                  <div style={{ overflow: "hidden", maxHeight: openAccordion === key ? 200 : 0, transition: "max-height 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
                    <p style={{ margin: "0 16px 16px", fontSize: 14, color: "#555", lineHeight: 1.6 }}>{content}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 40 }} />
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 10,
            background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.1))",
            pointerEvents: "none",
            opacity: atScrollBottom ? 0 : 1,
            transition: "opacity 0.4s ease",
            zIndex: 1,
          }}
        />
      </div>
    </div>
  );
}
