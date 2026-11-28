"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Captions,
  CaptionsOff,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  Frame,
  Keyboard,
  Loader2,
  LocateFixed,
  Maximize2,
  Minimize2,
  Pause,
  Pencil,
  Play,
  Redo2,
  RefreshCw,
  Search,
  Undo2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  BUILTIN_STYLE_TEMPLATES,
  editSingleWordInCue,
  findActiveEditorCue,
  findActiveEditorWord,
  formatMsClock,
  hydrateEditorCues,
  mergeAdjacentCues,
  normalizeCaptionStyle,
  reconcileCueWords,
  splitCueAtTimeMs,
  validateCaptionRevisionInput,
  type CaptionStyleConfig,
  type EditorCue,
  type SavedCaptionPresetRow,
} from "@/lib/caption-editor";
import { AccountMenu } from "@/components/AccountMenu";
import { ClipCaptionsMark } from "@/components/ClipCaptionsLogo";
import { EditorCaptionOverlay } from "@/components/EditorCaptionOverlay";
import { EditorTimeline } from "@/components/EditorTimeline";
import { ProjectExportModal } from "@/components/ProjectExportModal";
import { StudioStylePanel } from "@/components/StudioStylePanel";
import { StudioTabs, type StudioMobileTab } from "@/components/StudioTabs";
import { generateSrtFromCues } from "@/lib/exports";

type SaveStatus = "saved" | "saving" | "error" | "conflict";
type WorkspaceViewMode = "editor" | "timeline";

interface ConflictRevisionPayload {
  id: string;
  revision_number: number;
  style?: Partial<CaptionStyleConfig> | null;
  cues?: unknown;
}

interface EditorHistorySnapshot {
  cues: EditorCue[];
  style: CaptionStyleConfig;
}

interface ProjectCaptionEditorProps {
  mode?: "project" | "sample";
  userEmail?: string;
  projectId?: string;
  projectTitle: string;
  mediaKind: "video" | "audio";
  previewUrl: string;
  posterUrl?: string;
  previewWidth?: number | null;
  previewHeight?: number | null;
  durationMs: number;
  initialRevisionId?: string | null;
  initialRevisionNumber?: number;
  initialCues: EditorCue[];
  initialStyle: CaptionStyleConfig;
  initialPresets?: SavedCaptionPresetRow[];
}

const MAX_HISTORY_DEPTH = 50;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Finds either the active cue containing `timeMs` or, when inside a silent gap,
 * the closest upcoming (or final) cue so explicit seeks & Resume Following land sensibly.
 */
function findNearestCueAtTime(
  cues: EditorCue[],
  timeMs: number
): EditorCue | null {
  if (cues.length === 0) return null;
  const exact = findActiveEditorCue(cues, timeMs);
  if (exact) return exact;
  const upcoming = cues.find((c) => c.start_ms >= timeMs);
  return upcoming ?? cues[cues.length - 1] ?? null;
}

export function ProjectCaptionEditor({
  mode,
  userEmail = "",
  projectId = "",
  projectTitle,
  mediaKind,
  previewUrl,
  posterUrl,
  previewWidth = null,
  previewHeight = null,
  durationMs,
  initialRevisionId = null,
  initialRevisionNumber = 0,
  initialCues,
  initialStyle,
  initialPresets = [],
}: ProjectCaptionEditorProps) {
  const isSampleMode = mode === "sample" || !projectId;
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutsRef = useRef<HTMLDivElement | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const cueCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const playUntilMsRef = useRef<number | null>(null);
  const openTimelineBtnRef = useRef<HTMLButtonElement | null>(null);
  const backToEditorBtnRef = useRef<HTMLButtonElement | null>(null);

  // Follow-playback tracking refs (prevents programmatic scroll from suspending follow)
  const programmaticScrollUntilRef = useRef<number>(0);
  const prevActiveCueIdRef = useRef<string | null>(null);

  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("editor");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(
    initialCues[0] ? initialCues[0].start_ms : 0
  );
  const [clipDurationMs, setClipDurationMs] = useState(
    durationMs > 0 ? durationMs : 15000
  );
  const [videoDims, setVideoDims] = useState<{ w: number; h: number } | null>(
    previewWidth && previewHeight
      ? { w: previewWidth, h: previewHeight }
      : null
  );
  const [hasInitializedSeek, setHasInitializedSeek] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Transcript Follow-Playback state (enabled by default; suspends on manual scroll, search, or edit)
  const [followEnabled, setFollowEnabled] = useState(true);
  const [followSuspended, setFollowSuspended] = useState(false);

  // Phone single-panel switcher (Captions | Style)
  const [mobileTab, setMobileTab] = useState<StudioMobileTab>("captions");
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [showCaptionsOverlay, setShowCaptionsOverlay] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Explicit per-cue disclosures in Transcript (Edit words & exact Timing)
  const [expandedWordCueIds, setExpandedWordCueIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedTimingCueIds, setExpandedTimingCueIds] = useState<
    Record<string, boolean>
  >({});

  const [cues, setCues] = useState<EditorCue[]>(initialCues);
  const [style, setStyle] = useState<CaptionStyleConfig>(initialStyle);
  const [personalPresets, setPersonalPresets] =
    useState<SavedCaptionPresetRow[]>(initialPresets);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(
    initialCues[0]?.id ?? null
  );
  const [revisionNumber, setRevisionNumber] = useState(initialRevisionNumber);
  const [savedRevisionId, setSavedRevisionId] = useState<string | null>(
    initialRevisionId
  );
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Inline individual timed word edit state
  const [editingWord, setEditingWord] = useState<{
    cueId: string;
    wordId: string;
    draft: string;
  } | null>(null);

  // Transcript Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);

  // Undo / Redo history stacks
  const undoStackRef = useRef<EditorHistorySnapshot[]>([]);
  const redoStackRef = useRef<EditorHistorySnapshot[]>([]);
  const lastCoalesceRef = useRef<{ key: string; at: number } | null>(null);
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });

  // Concurrency & autosave refs
  const baseRevisionIdRef = useRef<string | null>(initialRevisionId);
  const localVersionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const inFlightRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCuesRef = useRef<EditorCue[]>(initialCues);
  const latestStyleRef = useRef<CaptionStyleConfig>(initialStyle);
  const saveStatusRef = useRef<SaveStatus>("saved");

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictRevision, setConflictRevision] =
    useState<ConflictRevisionPayload | null>(null);

  const setSaveStatusSynced = useCallback((next: SaveStatus) => {
    saveStatusRef.current = next;
    setSaveStatus(next);
  }, []);

  useEffect(() => {
    latestCuesRef.current = cues;
  }, [cues]);

  useEffect(() => {
    latestStyleRef.current = style;
  }, [style]);

  useEffect(() => {
    const el = mediaRef.current;
    if (el && el.readyState >= 1) {
      setIsMediaReady(true);
    }
  }, [previewUrl]);

  const syncHistoryCounts = useCallback(() => {
    setHistoryCounts({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    });
  }, []);

  const recordUndoSnapshot = useCallback(
    (snapshot: EditorHistorySnapshot, coalesceKey?: string) => {
      const now = Date.now();
      if (
        coalesceKey &&
        lastCoalesceRef.current &&
        lastCoalesceRef.current.key === coalesceKey &&
        now - lastCoalesceRef.current.at < 700
      ) {
        lastCoalesceRef.current.at = now;
        return;
      }

      undoStackRef.current = [
        ...undoStackRef.current.slice(-(MAX_HISTORY_DEPTH - 1)),
        snapshot,
      ];
      redoStackRef.current = [];
      lastCoalesceRef.current = coalesceKey
        ? { key: coalesceKey, at: now }
        : null;
      syncHistoryCounts();
    },
    [syncHistoryCounts]
  );

  const isLandscapeVideo = useMemo(() => {
    if (mediaKind !== "video" || !videoDims) return false;
    return videoDims.w > videoDims.h;
  }, [mediaKind, videoDims]);

  const mediaAspectBadge = useMemo(() => {
    if (mediaKind === "audio") return "Audio";
    if (!videoDims) return "Video";
    if (videoDims.w > videoDims.h) return "16:9";
    if (videoDims.w === videoDims.h) return "1:1";
    return "9:16";
  }, [mediaKind, videoDims]);

  const activeCue = useMemo(
    () => findActiveEditorCue(cues, currentTimeMs),
    [cues, currentTimeMs]
  );
  const activeCueIndex = useMemo(
    () => (activeCue ? cues.findIndex((c) => c.id === activeCue.id) : -1),
    [activeCue, cues]
  );
  const activeWord = useMemo(
    () => findActiveEditorWord(activeCue, currentTimeMs),
    [activeCue, currentTimeMs]
  );
  const selectedCueIndex = useMemo(
    () =>
      selectedCueId ? cues.findIndex((c) => c.id === selectedCueId) : -1,
    [cues, selectedCueId]
  );
  const selectedCue =
    selectedCueIndex >= 0 ? cues[selectedCueIndex] : activeCue ?? cues[0] ?? null;
  const effectiveSelectedIndex = useMemo(
    () => (selectedCue ? cues.findIndex((c) => c.id === selectedCue.id) : -1),
    [cues, selectedCue]
  );

  const activePresetShortLabel = useMemo(() => {
    const matched = BUILTIN_STYLE_TEMPLATES.find(
      (tpl) =>
        tpl.style.preset === style.preset &&
        tpl.style.fontFamily === style.fontFamily &&
        tpl.style.emphasisMode === style.emphasisMode &&
        tpl.style.alignment === style.alignment
    );
    if (matched) return matched.name;
    if (style.preset === "word-highlight") return "Highlight";
    if (style.preset === "boxed") return "Boxed";
    return "Clean";
  }, [style]);

  // Split / Merge eligibility checks
  const splitTargetCue = activeCue ?? selectedCue;
  const canSplitAtPlayhead = Boolean(
    splitTargetCue &&
      currentTimeMs >= splitTargetCue.start_ms + 200 &&
      currentTimeMs <= splitTargetCue.end_ms - 200
  );
  const mergeTargetIndex =
    selectedCueIndex >= 0 ? selectedCueIndex : activeCueIndex;
  const canMergeSelected =
    mergeTargetIndex >= 0 && mergeTargetIndex < cues.length - 1;

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const matchingCueIds = useMemo(() => {
    if (!trimmedQuery) return [];
    return cues
      .filter((cue) => cue.text.toLowerCase().includes(trimmedQuery))
      .map((cue) => cue.id);
  }, [cues, trimmedQuery]);

  const boundedMatchIdx =
    matchingCueIds.length > 0
      ? Math.min(activeMatchIdx, matchingCueIds.length - 1)
      : 0;
  const currentMatchedCueId =
    matchingCueIds.length > 0 ? matchingCueIds[boundedMatchIdx] : null;

  const clientValidation = useMemo(
    () =>
      validateCaptionRevisionInput({
        cues,
        style,
        durationMs: clipDurationMs,
      }),
    [cues, style, clipDurationMs]
  );

  /**
   * Scrolls ONLY `transcriptScrollRef` (never `window`), ONLY when `cueId` is
   * outside the visible area of `transcriptScrollRef` (unless `forceCenter` is true),
   * and respects `prefers-reduced-motion`. Never moves focus or changes `selectedCueId`.
   */
  const scrollTranscriptPaneToCue = useCallback(
    (cueId: string, forceReveal = false) => {
      const container = transcriptScrollRef.current;
      const card = cueCardRefs.current[cueId];
      if (!container || !card) return;
      if (container.scrollHeight <= container.clientHeight + 2) return;

      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const marginPx = 10;
      const isVisible =
        cardRect.top >= containerRect.top + marginPx &&
        cardRect.bottom <= containerRect.bottom - marginPx;

      if (isVisible && !forceReveal) {
        return;
      }

      const deltaTop = cardRect.top - containerRect.top;
      const targetScrollTop = Math.max(
        0,
        Math.min(
          container.scrollHeight - container.clientHeight,
          container.scrollTop + deltaTop - Math.round(container.clientHeight * 0.22)
        )
      );

      if (Math.abs(targetScrollTop - container.scrollTop) < 2) return;

      const reduced = prefersReducedMotion();
      programmaticScrollUntilRef.current = Date.now() + (reduced ? 140 : 620);
      container.scrollTo({
        top: targetScrollTop,
        behavior: reduced ? "auto" : "smooth",
      });
    },
    []
  );

  // Follow-playback effect on activeCue transitions (ignores silent gaps where activeCue is null)
  useEffect(() => {
    const activeId = activeCue?.id ?? null;
    if (activeId === prevActiveCueIdRef.current) {
      return;
    }
    prevActiveCueIdRef.current = activeId;

    if (!activeId) {
      // Silent gap between cues — keep transcript steady
      return;
    }
    if (viewMode !== "editor") return;
    if (!followEnabled || followSuspended) return;

    scrollTranscriptPaneToCue(activeId);
  }, [
    activeCue?.id,
    followEnabled,
    followSuspended,
    scrollTranscriptPaneToCue,
    viewMode,
  ]);

  const suspendFollowPlayback = useCallback(() => {
    if (followEnabled) {
      setFollowSuspended(true);
    }
  }, [followEnabled]);

  const handleResumeFollowing = useCallback(() => {
    setFollowEnabled(true);
    setFollowSuspended(false);
    const target = findNearestCueAtTime(latestCuesRef.current, currentTimeMs);
    if (target) {
      prevActiveCueIdRef.current = activeCue?.id ?? null;
      scrollTranscriptPaneToCue(target.id);
    }
  }, [activeCue?.id, currentTimeMs, scrollTranscriptPaneToCue]);

  const handleToggleFollowPlayback = useCallback(() => {
    if (!followEnabled) {
      setFollowEnabled(true);
      setFollowSuspended(false);
      const target = findNearestCueAtTime(latestCuesRef.current, currentTimeMs);
      if (target) {
        scrollTranscriptPaneToCue(target.id);
      }
    } else if (followSuspended) {
      // Clicking Follow when suspended resumes immediately
      handleResumeFollowing();
    } else {
      setFollowEnabled(false);
      setFollowSuspended(false);
    }
  }, [
    currentTimeMs,
    followEnabled,
    followSuspended,
    handleResumeFollowing,
    scrollTranscriptPaneToCue,
  ]);

  const handleTranscriptScroll = useCallback(() => {
    if (Date.now() <= programmaticScrollUntilRef.current) {
      return;
    }
    if (followEnabled && !followSuspended) {
      setFollowSuspended(true);
    }
  }, [followEnabled, followSuspended]);

  const openTimelineView = useCallback(() => {
    setViewMode("timeline");
    requestAnimationFrame(() => {
      backToEditorBtnRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const returnToEditorView = useCallback(() => {
    setViewMode("editor");
    requestAnimationFrame(() => {
      openTimelineBtnRef.current?.focus({ preventScroll: true });
    });
  }, []);

  // Close shortcuts popover on outside click / Escape
  useEffect(() => {
    if (!shortcutsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        shortcutsRef.current &&
        !shortcutsRef.current.contains(event.target as Node)
      ) {
        setShortcutsOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShortcutsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [shortcutsOpen]);

  // 60fps media clock sync + play-selected-cue auto-pause boundary
  useEffect(() => {
    if (!isPlaying) return;
    let frameId = 0;
    const tick = () => {
      const el = mediaRef.current;
      if (el) {
        const ms = Math.round(el.currentTime * 1000);
        setCurrentTimeMs(ms);
        if (playUntilMsRef.current !== null && ms >= playUntilMsRef.current) {
          el.pause();
          el.currentTime = playUntilMsRef.current / 1000;
          setCurrentTimeMs(playUntilMsRef.current);
          playUntilMsRef.current = null;
          return;
        }
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const seekToMs = useCallback(
    (nextMs: number, skipFollowScroll = false) => {
      playUntilMsRef.current = null;
      const clamped = Math.max(0, Math.min(clipDurationMs, Math.round(nextMs)));
      const el = mediaRef.current;
      if (el) {
        el.currentTime = clamped / 1000;
      }
      setCurrentTimeMs(clamped);

      if (
        !skipFollowScroll &&
        viewMode === "editor" &&
        followEnabled &&
        !followSuspended
      ) {
        const target = findNearestCueAtTime(latestCuesRef.current, clamped);
        if (target) {
          prevActiveCueIdRef.current =
            findActiveEditorCue(latestCuesRef.current, clamped)?.id ?? null;
          scrollTranscriptPaneToCue(target.id);
        }
      }
    },
    [
      clipDurationMs,
      followEnabled,
      followSuspended,
      scrollTranscriptPaneToCue,
      viewMode,
    ]
  );

  const togglePlay = useCallback(async () => {
    playUntilMsRef.current = null;
    const el = mediaRef.current;
    if (!el) return;
    setMediaError(null);
    if (el.paused || el.ended) {
      if (el.ended || el.currentTime * 1000 >= clipDurationMs - 50) {
        el.currentTime = 0;
        setCurrentTimeMs(0);
        if (
          viewMode === "editor" &&
          followEnabled &&
          !followSuspended &&
          latestCuesRef.current[0]
        ) {
          prevActiveCueIdRef.current = null;
          scrollTranscriptPaneToCue(latestCuesRef.current[0].id);
        }
      }
      try {
        await el.play();
      } catch {
        el.muted = true;
        setIsMuted(true);
        try {
          await el.play();
        } catch {
          setMediaError("Preview media could not start playback.");
        }
      }
    } else {
      el.pause();
    }
  }, [
    clipDurationMs,
    followEnabled,
    followSuspended,
    scrollTranscriptPaneToCue,
    viewMode,
  ]);

  const retryMediaPlayback = useCallback(() => {
    const el = mediaRef.current;
    setMediaError(null);
    setIsMediaReady(false);
    if (!el) return;
    el.load();
    void togglePlay();
  }, [togglePlay]);

  const playSelectedCue = useCallback(async () => {
    const cue = selectedCue;
    const el = mediaRef.current;
    if (!cue || !el) return;
    setSelectedCueId(cue.id);
    playUntilMsRef.current = cue.end_ms;
    el.currentTime = cue.start_ms / 1000;
    setCurrentTimeMs(cue.start_ms);
    try {
      await el.play();
    } catch {
      el.muted = true;
      setIsMuted(true);
      await el.play().catch(() => {});
    }
  }, [selectedCue]);

  const toggleMute = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setIsMuted(el.muted);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    setIsMediaReady(true);
    setMediaError(null);
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setClipDurationMs(Math.round(el.duration * 1000));
    }
    if (
      el instanceof HTMLVideoElement &&
      el.videoWidth > 0 &&
      el.videoHeight > 0
    ) {
      setVideoDims({ w: el.videoWidth, h: el.videoHeight });
    }
    if (!hasInitializedSeek && initialCues[0]) {
      el.currentTime = initialCues[0].start_ms / 1000;
      setCurrentTimeMs(initialCues[0].start_ms);
      setHasInitializedSeek(true);
    }
  }, [hasInitializedSeek, initialCues]);

  const handleTimeUpdate = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (
      !hasInitializedSeek &&
      el.paused &&
      el.currentTime === 0 &&
      initialCues[0]
    ) {
      return;
    }
    setCurrentTimeMs(Math.round(el.currentTime * 1000));
  }, [hasInitializedSeek, initialCues]);

  // Core save runner preserving newer local edits across in-flight saves, conflicts, and failures
  const performSave = useCallback(async () => {
    if (isSampleMode || !projectId || inFlightRef.current) return;

    const snapshotVersion = localVersionRef.current;
    const snapshotCues = latestCuesRef.current;
    const snapshotStyle = latestStyleRef.current;

    const check = validateCaptionRevisionInput({
      cues: snapshotCues,
      style: snapshotStyle,
      durationMs: clipDurationMs,
    });

    if (!check.ok) {
      setSaveStatusSynced("error");
      setSaveError(check.error);
      return;
    }

    inFlightRef.current = true;
    setSaveStatusSynced("saving");
    setSaveError(null);
    let didSucceed = false;

    try {
      const res = await fetch(`/api/projects/${projectId}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseRevisionId: baseRevisionIdRef.current,
          cues: check.normalizedCues,
          style: check.normalizedStyle,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setConflictRevision(
          (data.currentRevision as ConflictRevisionPayload | null) ?? null
        );
        setSaveStatusSynced("conflict");
        setSaveError(
          data.error || "This project was updated in another tab."
        );
        return;
      }

      if (!res.ok) {
        setSaveStatusSynced("error");
        setSaveError(data.error || `Save failed (HTTP ${res.status}).`);
        return;
      }

      const savedRev = data.revision as {
        id: string;
        revision_number: number;
      };
      baseRevisionIdRef.current = savedRev.id;
      savedVersionRef.current = snapshotVersion;
      didSucceed = true;
      setSavedRevisionId(savedRev.id);
      setRevisionNumber(savedRev.revision_number);
      setConflictRevision(null);

      if (localVersionRef.current > snapshotVersion) {
        setSaveStatusSynced("saving");
      } else {
        setSaveStatusSynced("saved");
      }
    } catch {
      setSaveStatusSynced("error");
      setSaveError(
        "Network error while saving. Your local edits are preserved."
      );
    } finally {
      inFlightRef.current = false;
      if (
        didSucceed &&
        localVersionRef.current > savedVersionRef.current &&
        saveStatusRef.current !== "conflict"
      ) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          void performSave();
        }, 350);
      }
    }
  }, [clipDurationMs, isSampleMode, projectId, setSaveStatusSynced]);

  const scheduleAutosave = useCallback(() => {
    localVersionRef.current += 1;
    if (isSampleMode || !projectId) {
      return;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (saveStatusRef.current === "conflict") {
      return;
    }
    setSaveStatusSynced("saving");
    setSaveError(null);
    debounceTimerRef.current = setTimeout(() => {
      void performSave();
    }, 650);
  }, [isSampleMode, performSave, projectId, setSaveStatusSynced]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const flashNotice = useCallback((msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice((curr) => (curr === msg ? null : curr));
    }, 2800);
  }, []);

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;

    const previous = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    redoStackRef.current = [
      ...redoStackRef.current.slice(-(MAX_HISTORY_DEPTH - 1)),
      { cues: latestCuesRef.current, style: latestStyleRef.current },
    ];
    lastCoalesceRef.current = null;

    latestCuesRef.current = previous.cues;
    latestStyleRef.current = previous.style;
    setCues(previous.cues);
    setStyle(previous.style);
    setEditingWord(null);
    syncHistoryCounts();
    scheduleAutosave();
  }, [scheduleAutosave, syncHistoryCounts]);

  const handleRedo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;

    const next = stack[stack.length - 1];
    redoStackRef.current = stack.slice(0, -1);
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_HISTORY_DEPTH - 1)),
      { cues: latestCuesRef.current, style: latestStyleRef.current },
    ];
    lastCoalesceRef.current = null;

    latestCuesRef.current = next.cues;
    latestStyleRef.current = next.style;
    setCues(next.cues);
    setStyle(next.style);
    setEditingWord(null);
    syncHistoryCounts();
    scheduleAutosave();
  }, [scheduleAutosave, syncHistoryCounts]);

  const handleSplitAtPlayhead = useCallback(() => {
    const target = activeCue ?? selectedCue;
    if (!target) return;
    const res = splitCueAtTimeMs(
      latestCuesRef.current,
      target.id,
      currentTimeMs
    );
    if (!res.ok) {
      flashNotice(res.error);
      return;
    }
    recordUndoSnapshot({
      cues: latestCuesRef.current,
      style: latestStyleRef.current,
    });
    latestCuesRef.current = res.cues;
    setCues(res.cues);
    setSelectedCueId(res.secondCueId);
    setEditingWord(null);
    scheduleAutosave();
    flashNotice("Split cue at playhead");
  }, [
    activeCue,
    currentTimeMs,
    flashNotice,
    recordUndoSnapshot,
    scheduleAutosave,
    selectedCue,
  ]);

  const handleMergeSelectedWithNext = useCallback(() => {
    const idx = selectedCueIndex >= 0 ? selectedCueIndex : activeCueIndex;
    const res = mergeAdjacentCues(latestCuesRef.current, idx);
    if (!res.ok) {
      flashNotice(res.error);
      return;
    }
    recordUndoSnapshot({
      cues: latestCuesRef.current,
      style: latestStyleRef.current,
    });
    latestCuesRef.current = res.cues;
    setCues(res.cues);
    setSelectedCueId(res.mergedCueId);
    setEditingWord(null);
    scheduleAutosave();
    flashNotice("Merged adjacent cues");
  }, [
    activeCueIndex,
    flashNotice,
    recordUndoSnapshot,
    scheduleAutosave,
    selectedCueIndex,
  ]);

  const commitInlineWordEdit = useCallback(() => {
    if (!editingWord) return;
    suspendFollowPlayback();
    const { cueId, wordId, draft } = editingWord;
    const nextCues = editSingleWordInCue(
      latestCuesRef.current,
      cueId,
      wordId,
      draft
    );
    if (nextCues !== latestCuesRef.current) {
      recordUndoSnapshot({
        cues: latestCuesRef.current,
        style: latestStyleRef.current,
      });
      latestCuesRef.current = nextCues;
      setCues(nextCues);
      scheduleAutosave();
    }
    setEditingWord(null);
  }, [editingWord, recordUndoSnapshot, scheduleAutosave, suspendFollowPlayback]);

  // Keyboard shortcuts safely scoped around active typing
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isSearchField = target === searchInputRef.current;
      const isMod = event.ctrlKey || event.metaKey;

      if (isMod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setViewMode("editor");
        setMobileTab("captions");
        suspendFollowPlayback();
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
        return;
      }

      if (isMod && !isSearchField) {
        const lower = event.key.toLowerCase();
        if (lower === "z" && !event.shiftKey) {
          if (undoStackRef.current.length > 0) {
            event.preventDefault();
            handleUndo();
          }
          return;
        }
        if ((lower === "z" && event.shiftKey) || lower === "y") {
          if (redoStackRef.current.length > 0) {
            event.preventDefault();
            handleRedo();
          }
          return;
        }
      }

      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "BUTTON" ||
          target.tagName === "SELECT" ||
          target.tagName === "A" ||
          target.getAttribute("role") === "tab" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        void togglePlay();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekToMs(currentTimeMs - (event.shiftKey ? 5000 : 1000));
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        seekToMs(currentTimeMs + (event.shiftKey ? 5000 : 1000));
      } else if (event.key.toLowerCase() === "s" && !isMod) {
        event.preventDefault();
        handleSplitAtPlayhead();
      } else if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen((prev) => !prev);
      } else if (
        event.key === "Escape" &&
        viewMode === "timeline" &&
        !shortcutsOpen &&
        !exportModalOpen
      ) {
        event.preventDefault();
        returnToEditorView();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    currentTimeMs,
    exportModalOpen,
    handleRedo,
    handleSplitAtPlayhead,
    handleUndo,
    returnToEditorView,
    seekToMs,
    shortcutsOpen,
    suspendFollowPlayback,
    togglePlay,
    viewMode,
  ]);

  const navigateSearchMatch = useCallback(
    (direction: 1 | -1) => {
      if (matchingCueIds.length === 0) return;
      suspendFollowPlayback();
      const nextIdx =
        (boundedMatchIdx + direction + matchingCueIds.length) %
        matchingCueIds.length;
      const targetId = matchingCueIds[nextIdx];
      setActiveMatchIdx(nextIdx);
      setSelectedCueId(targetId);
      const found = cues.find((c) => c.id === targetId);
      if (found) {
        seekToMs(found.start_ms, true);
        scrollTranscriptPaneToCue(targetId);
      }
    },
    [
      boundedMatchIdx,
      cues,
      matchingCueIds,
      scrollTranscriptPaneToCue,
      seekToMs,
      suspendFollowPlayback,
    ]
  );

  const handleSelectTimelineCue = useCallback(
    (cueId: string, startMs: number) => {
      setSelectedCueId(cueId);
      seekToMs(startMs);
    },
    [seekToMs]
  );

  const handleTimelinePreviewCues = useCallback((nextCues: EditorCue[]) => {
    latestCuesRef.current = nextCues;
    setCues(nextCues);
  }, []);

  const handleTimelineCommitCues = useCallback(
    (beforeCues: EditorCue[], afterCues: EditorCue[]) => {
      recordUndoSnapshot({
        cues: beforeCues,
        style: latestStyleRef.current,
      });
      latestCuesRef.current = afterCues;
      setCues(afterCues);
      scheduleAutosave();
    },
    [recordUndoSnapshot, scheduleAutosave]
  );

  const updateCueText = (cueId: string, nextText: string) => {
    suspendFollowPlayback();
    recordUndoSnapshot(
      { cues: latestCuesRef.current, style: latestStyleRef.current },
      `text:${cueId}`
    );

    setCues((prev) => {
      const next = prev.map((cue) => {
        if (cue.id !== cueId) return cue;
        const reconciled = reconcileCueWords(
          cue,
          nextText,
          cue.start_ms,
          cue.end_ms
        );
        return {
          ...cue,
          text: nextText,
          words: reconciled.words,
          timing_mode: reconciled.timing_mode,
        };
      });
      latestCuesRef.current = next;
      return next;
    });
    scheduleAutosave();
  };

  const updateCueTiming = (
    cueId: string,
    field: "start_ms" | "end_ms",
    secondsInput: string
  ) => {
    const parsedSec = Number(secondsInput);
    if (!Number.isFinite(parsedSec)) return;
    const nextMs = Math.max(0, Math.round(parsedSec * 1000));

    suspendFollowPlayback();
    recordUndoSnapshot(
      { cues: latestCuesRef.current, style: latestStyleRef.current },
      `time:${cueId}:${field}`
    );

    setCues((prev) => {
      const next = prev.map((cue) => {
        if (cue.id !== cueId) return cue;
        const nextStart = field === "start_ms" ? nextMs : cue.start_ms;
        const nextEnd = field === "end_ms" ? nextMs : cue.end_ms;
        const reconciled =
          nextEnd > nextStart
            ? reconcileCueWords(cue, cue.text, nextStart, nextEnd)
            : { words: cue.words, timing_mode: cue.timing_mode };
        return {
          ...cue,
          start_ms: nextStart,
          end_ms: nextEnd,
          words: reconciled.words,
          timing_mode: reconciled.timing_mode,
        };
      });
      latestCuesRef.current = next;
      return next;
    });
    scheduleAutosave();
  };

  const updateStyle = (patch: Partial<CaptionStyleConfig>) => {
    const coalesceKey =
      patch.verticalPosition !== undefined
        ? "style:vpos"
        : patch.backgroundOpacity !== undefined
          ? "style:bgop"
          : undefined;
    recordUndoSnapshot(
      { cues: latestCuesRef.current, style: latestStyleRef.current },
      coalesceKey
    );
    setStyle((prev) => {
      const next = normalizeCaptionStyle({ ...prev, ...patch });
      latestStyleRef.current = next;
      return next;
    });
    scheduleAutosave();
  };

  const reloadLatestFromConflict = () => {
    if (!conflictRevision) return;
    const nextCues = hydrateEditorCues(conflictRevision.cues);
    const nextStyle = normalizeCaptionStyle(conflictRevision.style);
    baseRevisionIdRef.current = conflictRevision.id;
    setSavedRevisionId(conflictRevision.id);
    setRevisionNumber(conflictRevision.revision_number);
    latestCuesRef.current = nextCues;
    latestStyleRef.current = nextStyle;
    setCues(nextCues);
    setStyle(nextStyle);
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistoryCounts();
    savedVersionRef.current = localVersionRef.current;
    setConflictRevision(null);
    setSaveError(null);
    setSaveStatusSynced("saved");
  };

  const saveLocalOverConflict = () => {
    if (!conflictRevision) return;
    baseRevisionIdRef.current = conflictRevision.id;
    setConflictRevision(null);
    setSaveError(null);
    setSaveStatusSynced("saving");
    void performSave();
  };

  const downloadSampleSrt = useCallback(() => {
    const srtText = generateSrtFromCues(cues);
    if (!srtText) return;
    const blob = new Blob([srtText], {
      type: "application/x-subrip;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clipcaptions-sample.srt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flashNotice("Downloaded clipcaptions-sample.srt");
  }, [cues, flashNotice]);

  const resetSampleEdits = useCallback(() => {
    latestCuesRef.current = initialCues;
    latestStyleRef.current = initialStyle;
    setCues(initialCues);
    setStyle(initialStyle);
    setSelectedCueId(initialCues[0]?.id ?? null);
    setEditingWord(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistoryCounts();
    flashNotice("Reset sample to original captions and style");
  }, [flashNotice, initialCues, initialStyle, syncHistoryCounts]);

  const playheadProgressPct =
    clipDurationMs > 0
      ? Math.min(100, Math.max(0, (currentTimeMs / clipDurationMs) * 100))
      : 0;

  const isActivelyFollowing = followEnabled && !followSuspended;

  // Give center video generous usable space on desktop while keeping mobile compact & reachable
  const stageSizeClasses = useMemo(() => {
    if (viewMode === "timeline") {
      return isLandscapeVideo
        ? "aspect-video w-full max-w-[270px] sm:max-w-[340px] lg:max-w-[380px]"
        : "aspect-[9/16] w-[124px] sm:w-[138px] lg:w-[148px]";
    }
    if (isLandscapeVideo) {
      return previewExpanded
        ? "aspect-video w-full max-w-[360px] sm:max-w-[600px] lg:max-w-[680px] xl:max-w-[800px]"
        : "aspect-video w-full max-w-[276px] sm:max-w-[540px] lg:max-w-[590px] xl:max-w-[720px]";
    }
    return previewExpanded
      ? "aspect-[9/16] w-[232px] sm:w-[276px] lg:w-[320px] xl:w-[356px]"
      : "aspect-[9/16] w-[144px] sm:w-[244px] lg:w-[288px] xl:w-[320px]";
  }, [isLandscapeVideo, previewExpanded, viewMode]);

  return (
    <div
      data-testid="caption-editor-root"
      data-view-mode={viewMode}
      className="min-h-screen overflow-x-clip bg-page text-ink"
    >
      {/* Compact Header */}
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-page/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-1.5 sm:flex-nowrap sm:gap-3 sm:px-5 sm:py-2 lg:px-6">
          <Link
            href={isSampleMode ? "/" : "/projects"}
            prefetch={isSampleMode ? undefined : false}
            className="order-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink/12 bg-panel px-2 py-1 text-xs font-medium text-ink-secondary transition hover:border-ink/25 hover:text-ink sm:gap-1.5 sm:px-2.5 sm:py-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{isSampleMode ? "Home" : "Projects"}</span>
          </Link>

          <div className="order-3 flex w-full min-w-0 items-center justify-between gap-2 sm:order-2 sm:w-auto sm:flex-1 sm:justify-start">
            <span
              aria-hidden="true"
              className="hidden h-4 w-px shrink-0 bg-ink/12 sm:inline-block"
            />
            {isSampleMode && (
              <ClipCaptionsMark size={18} className="hidden shrink-0 sm:block" />
            )}
            <h1 className="truncate text-xs font-semibold tracking-tight text-ink sm:text-sm lg:text-base">
              {projectTitle}
            </h1>
            <div className="flex shrink-0 items-center gap-1.5">
              {isSampleMode ? (
                <span
                  data-testid="editor-mode-badge"
                  className="rounded-md bg-panel px-2 py-0.5 text-[10px] font-medium text-ink-secondary sm:text-[11px]"
                >
                  Sample · Local
                </span>
              ) : (
                <span className="rounded-md bg-panel px-2 py-0.5 font-mono text-[10px] tabular-nums text-ink-muted sm:text-[11px]">
                  Rev #{revisionNumber}
                </span>
              )}
              <span
                data-testid="editor-media-aspect"
                className="hidden rounded-md bg-panel px-2 py-0.5 text-[11px] font-medium text-ink-muted xl:inline-block"
              >
                {mediaAspectBadge}
              </span>
            </div>
          </div>

          <div className="order-2 flex shrink-0 items-center gap-1.5 sm:order-3 sm:gap-2">
            {/* Single Accessible Undo / Redo Pair */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="editor-undo-btn"
                disabled={historyCounts.undo === 0}
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink/12 bg-panel text-ink-secondary transition hover:border-ink/25 hover:text-ink disabled:opacity-35 sm:h-8 sm:w-8"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                data-testid="editor-redo-btn"
                disabled={historyCounts.redo === 0}
                onClick={handleRedo}
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink/12 bg-panel text-ink-secondary transition hover:border-ink/25 hover:text-ink disabled:opacity-35 sm:h-8 sm:w-8"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {isSampleMode ? (
              <>
                {historyCounts.undo > 0 && (
                  <button
                    type="button"
                    data-testid="sample-reset-btn"
                    onClick={resetSampleEdits}
                    className="hidden rounded-lg border border-ink/12 bg-panel px-2.5 py-1 text-xs font-medium text-ink-secondary transition hover:border-ink/25 hover:text-ink md:inline-flex"
                  >
                    Reset
                  </button>
                )}

                <button
                  type="button"
                  data-testid="sample-download-srt-btn"
                  onClick={downloadSampleSrt}
                  className="inline-flex items-center gap-1 rounded-lg border border-ink/15 bg-panel px-2 py-1 text-xs font-semibold text-ink transition hover:border-ink/30 sm:gap-1.5 sm:px-3 sm:py-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-ink-secondary" />
                  <span>Download SRT</span>
                </button>

                <a
                  href="/upload"
                  data-testid="sample-upload-cta"
                  className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-page transition hover:bg-accent-hover sm:gap-1.5 sm:px-3 sm:py-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload a clip</span>
                </a>
              </>
            ) : (
              <>
                {/* Quiet Save Indicator */}
                <span
                  role="status"
                  aria-live="polite"
                  data-testid="autosave-status"
                  data-status={saveStatus}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium sm:gap-1.5 sm:px-2.5 sm:text-xs ${
                    saveStatus === "saved"
                      ? "bg-panel text-ink-secondary"
                      : saveStatus === "saving"
                        ? "border border-amber-400/30 bg-amber-400/10 text-amber-200"
                        : "border border-rose-400/35 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  {saveStatus === "saving" && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {saveStatus === "saved" && (
                    <CheckCircle2 className="h-3 w-3 text-ink-muted" />
                  )}
                  {saveStatus === "error" && (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  {saveStatus === "conflict" && (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  <span>
                    {saveStatus === "saving"
                      ? "Saving..."
                      : saveStatus === "saved"
                        ? "Saved"
                        : saveStatus === "conflict"
                          ? "Conflict"
                          : "Save failed"}
                  </span>
                </span>

                {saveStatus === "error" && (
                  <button
                    type="button"
                    onClick={() => void performSave()}
                    className="inline-flex items-center gap-1 rounded-lg border border-ink/15 bg-elevated px-2 py-1 text-xs font-medium text-ink transition hover:border-ink/30"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Retry</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="open-export-btn"
                  onClick={() => setExportModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-page transition hover:bg-accent-hover sm:gap-1.5 sm:px-3.5 sm:py-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export</span>
                </button>

                <AccountMenu userEmail={userEmail} compactMobile />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto w-full max-w-[1520px] px-3 py-2.5 sm:px-5 lg:px-6 lg:py-3.5">
        {actionNotice && (
          <div
            role="status"
            data-testid="editor-action-notice"
            className="mb-2.5 rounded-xl border border-ink/15 bg-panel px-3.5 py-2 text-xs font-medium text-ink"
          >
            {actionNotice}
          </div>
        )}

        {/* Stale-Tab Conflict Recovery Banner */}
        {saveStatus === "conflict" && (
          <div
            role="alert"
            data-testid="conflict-banner"
            className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-100"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div>
                <p className="font-semibold">
                  {saveError || "This project was updated in another tab."}
                </p>
                <p className="mt-0.5 text-amber-200/80">
                  Your local edits are preserved. Reload the latest revision or
                  save your edits as a new revision.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {conflictRevision && (
                <button
                  type="button"
                  onClick={reloadLatestFromConflict}
                  className="rounded-lg border border-amber-300/35 bg-panel px-3 py-1.5 font-semibold text-amber-100 transition hover:bg-elevated"
                >
                  Reload latest (Rev #{conflictRevision.revision_number})
                </button>
              )}
              {conflictRevision && (
                <button
                  type="button"
                  onClick={saveLocalOverConflict}
                  className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-page transition hover:bg-accent-hover"
                >
                  Save my edits as new
                </button>
              )}
            </div>
          </div>
        )}

        {/* Validation / Save Error Banner */}
        {(saveStatus === "error" || !clientValidation.ok) &&
          saveStatus !== "conflict" && (
            <div
              role="alert"
              data-testid="editor-error-banner"
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {!clientValidation.ok ? clientValidation.error : saveError}
                </span>
              </div>
              {clientValidation.ok && (
                <button
                  type="button"
                  onClick={() => void performSave()}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-300/30 bg-panel px-2.5 py-1 text-xs font-semibold text-rose-100 hover:border-ink/30"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry save</span>
                </button>
              )}
            </div>
          )}

        {/* Focused Timeline View Header Bar */}
        {viewMode === "timeline" && (
          <div
            data-testid="timeline-view-header"
            className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink/10 bg-panel px-3.5 py-2"
          >
            <div className="flex items-center gap-2.5">
              <button
                ref={backToEditorBtnRef}
                type="button"
                data-testid="back-to-editor-btn"
                onClick={returnToEditorView}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-page transition hover:bg-accent-hover"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to editor</span>
              </button>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-ink">
                  Focused Timeline
                </p>
                <p className="text-[11px] text-ink-muted">
                  Scrub the waveform, drag cue boundaries, or enter exact times
                  below
                </p>
              </div>
            </div>

            {cues.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={effectiveSelectedIndex <= 0}
                  onClick={() => {
                    const prev = cues[effectiveSelectedIndex - 1];
                    if (prev) {
                      setSelectedCueId(prev.id);
                      seekToMs(prev.start_ms);
                    }
                  }}
                  aria-label="Select previous cue"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink/10 bg-page text-ink-secondary transition hover:border-ink/25 hover:text-ink disabled:opacity-35"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono text-xs text-ink-secondary">
                  Cue #{Math.max(1, effectiveSelectedIndex + 1)}/{cues.length}
                </span>
                <button
                  type="button"
                  disabled={
                    effectiveSelectedIndex < 0 ||
                    effectiveSelectedIndex >= cues.length - 1
                  }
                  onClick={() => {
                    const next = cues[effectiveSelectedIndex + 1];
                    if (next) {
                      setSelectedCueId(next.id);
                      seekToMs(next.start_ms);
                    }
                  }}
                  aria-label="Select next cue"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink/10 bg-page text-ink-secondary transition hover:border-ink/25 hover:text-ink disabled:opacity-35"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Persistent 3-Column Workspace Grid */}
        <div
          className={
            viewMode === "timeline"
              ? "flex flex-col gap-3"
              : "flex flex-col gap-2.5 sm:gap-3.5 lg:grid lg:grid-cols-[324px_minmax(0,1fr)_336px] lg:items-start lg:gap-4 xl:grid-cols-[352px_minmax(0,1fr)_364px] xl:gap-5"
          }
        >
          {/* =================================================================
              CHILD 1: CENTER LIVE PREVIEW + PLAYBACK TRANSPORT
             ================================================================= */}
          <section
            aria-label="Caption preview and playback"
            className={`order-1 flex min-w-0 flex-col ${
              viewMode === "editor" ? "lg:order-2" : ""
            }`}
          >
            <div
              className={`relative flex items-center justify-center rounded-2xl border border-ink/10 bg-panel px-3 ${
                viewMode === "timeline"
                  ? "py-2"
                  : "py-2.5 sm:px-5 sm:py-3.5 lg:py-4"
              }`}
            >
              {/* Safe-Area Guide Toggle on Stage */}
              <button
                type="button"
                data-testid="stage-safe-area-btn"
                onClick={() => setShowSafeArea((v) => !v)}
                aria-pressed={showSafeArea}
                title="Toggle social safe-area guide"
                className={`absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition sm:right-3 sm:top-3 ${
                  showSafeArea
                    ? "border-accent bg-accent text-page font-semibold"
                    : "border-ink/12 bg-page/85 text-ink-secondary hover:border-ink/30 hover:text-ink"
                }`}
              >
                <Frame className="h-3 w-3" />
                <span className="hidden sm:inline">Safe area</span>
              </button>

              <div
                data-testid="editor-preview-stage"
                data-orientation={isLandscapeVideo ? "landscape" : "portrait"}
                data-mobile-expanded={previewExpanded ? "true" : "false"}
                data-captions-visible={showCaptionsOverlay ? "true" : "false"}
                className={`studio-stage-container relative overflow-hidden rounded-[1.15rem] border border-ink/12 bg-page shadow-[0_18px_48px_rgba(0,0,0,0.5)] transition-[width,max-width] duration-200 ${stageSizeClasses}`}
              >
                {mediaKind === "video" ? (
                  <video
                    ref={(el) => {
                      mediaRef.current = el;
                    }}
                    src={previewUrl}
                    poster={posterUrl}
                    playsInline
                    preload="auto"
                    muted={isMuted}
                    onLoadedMetadata={handleLoadedMetadata}
                    onCanPlay={() => setIsMediaReady(true)}
                    onTimeUpdate={handleTimeUpdate}
                    onSeeked={handleTimeUpdate}
                    onPlay={() => {
                      setMediaError(null);
                      setIsPlaying(true);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onError={() =>
                      setMediaError(
                        "Preview media failed to load. Try reloading or retrying."
                      )
                    }
                    onClick={() => void togglePlay()}
                    className="h-full w-full cursor-pointer bg-page object-contain"
                  />
                ) : (
                  <div
                    data-testid="editor-audio-stage"
                    onClick={() => void togglePlay()}
                    className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center bg-gradient-to-b from-elevated via-panel to-page p-4 text-center"
                  >
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-ink/15 bg-panel text-accent">
                      <AudioLines className="h-6 w-6" />
                    </span>
                    <p className="mt-2.5 max-w-full truncate text-xs font-semibold text-ink">
                      {projectTitle}
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-muted">
                      Audio preview
                    </p>
                    <audio
                      ref={(el) => {
                        mediaRef.current = el;
                      }}
                      src={previewUrl}
                      preload="auto"
                      muted={isMuted}
                      onLoadedMetadata={handleLoadedMetadata}
                      onCanPlay={() => setIsMediaReady(true)}
                      onTimeUpdate={handleTimeUpdate}
                      onSeeked={handleTimeUpdate}
                      onPlay={() => {
                        setMediaError(null);
                        setIsPlaying(true);
                      }}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      onError={() =>
                        setMediaError(
                          "Audio preview failed to load. Try reloading or retrying."
                        )
                      }
                    />
                  </div>
                )}

                {!isMediaReady && !mediaError && !posterUrl && (
                  <div
                    role="status"
                    data-testid="editor-media-loading"
                    className="pointer-events-none absolute left-2.5 top-2.5 z-20 inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-page/85 px-2.5 py-0.5 text-[10px] font-medium text-ink-secondary backdrop-blur-md"
                  >
                    <Loader2 className="h-3 w-3 animate-spin text-accent" />
                    <span>Loading preview...</span>
                  </div>
                )}

                {!showCaptionsOverlay && (
                  <div
                    data-testid="captions-hidden-badge"
                    className="pointer-events-none absolute left-2.5 top-2.5 z-20 rounded-md border border-ink/15 bg-page/85 px-2 py-0.5 text-[10px] font-medium text-ink-secondary backdrop-blur-md"
                  >
                    Captions hidden
                  </div>
                )}

                {showSafeArea && (
                  <div
                    aria-hidden="true"
                    data-testid="editor-safe-area-guide"
                    className="pointer-events-none absolute inset-0 z-10"
                  >
                    <div className="absolute inset-x-0 top-0 h-[12%] border-b border-dashed border-accent/65 bg-accent/10" />
                    {!isLandscapeVideo && (
                      <div className="absolute bottom-0 right-0 top-[12%] w-[16%] border-l border-dashed border-accent/65 bg-accent/10" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-[18%] border-t border-dashed border-accent/65 bg-accent/10" />
                  </div>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-page/85 via-page/30 to-transparent" />

                {showCaptionsOverlay && (
                  <EditorCaptionOverlay
                    activeCue={activeCue}
                    activeWord={activeWord}
                    style={style}
                    currentTimeMs={currentTimeMs}
                  />
                )}

                {!isPlaying && viewMode === "editor" && (
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-1/2 top-1/2 z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink/20 bg-page/80 text-ink shadow-xl backdrop-blur-md ${
                      previewExpanded ? "flex" : "hidden sm:flex"
                    }`}
                  >
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  </div>
                )}
              </div>
            </div>

            {mediaError && (
              <div
                role="alert"
                data-testid="editor-media-error"
                className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
              >
                <span className="inline-flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{mediaError}</span>
                </span>
                <button
                  type="button"
                  onClick={retryMediaPlayback}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-300/30 bg-panel px-2.5 py-1 text-xs font-semibold text-rose-100 hover:border-ink/30"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* Playback Bar Close to Video: Play, Seek, Time, Mute, Caption Overlay Toggle, Expand, Shortcuts */}
            <div className="mt-2 rounded-2xl border border-ink/10 bg-panel px-3 py-2">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  ref={playButtonRef}
                  type="button"
                  data-testid="play-pause-btn"
                  onClick={() => void togglePlay()}
                  title="Play / Pause (Space)"
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-page transition hover:bg-accent-hover"
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                  )}
                </button>

                <div className="relative flex h-6 min-w-0 flex-1 items-center">
                  <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-track">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${playheadProgressPct}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1000, clipDurationMs)}
                    step={20}
                    value={currentTimeMs}
                    data-testid="preview-seek-slider"
                    onChange={(e) => seekToMs(Number(e.target.value))}
                    aria-label="Seek preview"
                    aria-valuetext={`${formatMsClock(currentTimeMs)} of ${formatMsClock(clipDurationMs)}`}
                    className="studio-scrubber relative z-10 w-full"
                  />
                </div>

                <div
                  data-testid="editor-time-readout"
                  className="shrink-0 font-mono text-[11px] font-medium tabular-nums text-ink-secondary sm:text-xs"
                >
                  <span className="text-ink">
                    {formatMsClock(currentTimeMs)}
                  </span>
                  <span className="mx-0.5 text-ink-muted">/</span>
                  <span>{formatMsClock(clipDurationMs)}</span>
                </div>

                <button
                  type="button"
                  data-testid="mute-btn"
                  onClick={toggleMute}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  title={isMuted ? "Unmute" : "Mute"}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-page text-ink-secondary transition hover:border-ink/25 hover:text-ink"
                >
                  {isMuted ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>

                {/* Preview Caption Overlay Toggle */}
                <button
                  type="button"
                  data-testid="toggle-caption-overlay-btn"
                  aria-pressed={showCaptionsOverlay}
                  onClick={() => setShowCaptionsOverlay((v) => !v)}
                  title={
                    showCaptionsOverlay
                      ? "Hide caption overlay on preview"
                      : "Show caption overlay on preview"
                  }
                  aria-label={
                    showCaptionsOverlay
                      ? "Hide caption overlay"
                      : "Show caption overlay"
                  }
                  className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border px-2 text-xs font-medium transition ${
                    showCaptionsOverlay
                      ? "border-accent/50 bg-accent-soft text-accent-hover"
                      : "border-ink/10 bg-page text-ink-muted hover:border-ink/25 hover:text-ink"
                  }`}
                >
                  {showCaptionsOverlay ? (
                    <Captions className="h-3.5 w-3.5" />
                  ) : (
                    <CaptionsOff className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden xl:inline">CC</span>
                </button>

                {viewMode === "editor" && (
                  <button
                    type="button"
                    data-testid="toggle-expand-preview-btn"
                    aria-expanded={previewExpanded}
                    onClick={() => setPreviewExpanded((v) => !v)}
                    title={
                      previewExpanded ? "Collapse preview" : "Expand preview"
                    }
                    aria-label={
                      previewExpanded ? "Collapse preview" : "Expand preview"
                    }
                    className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border px-2 text-xs font-medium transition ${
                      previewExpanded
                        ? "border-accent bg-accent text-page font-semibold"
                        : "border-ink/10 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
                    }`}
                  >
                    {previewExpanded ? (
                      <>
                        <Minimize2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Shrink</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Expand</span>
                      </>
                    )}
                  </button>
                )}

                <div ref={shortcutsRef} className="relative shrink-0">
                  <button
                    type="button"
                    data-testid="shortcuts-toggle-btn"
                    aria-expanded={shortcutsOpen}
                    aria-label="Keyboard shortcuts"
                    title="Keyboard shortcuts (?)"
                    onClick={() => setShortcutsOpen((prev) => !prev)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border text-xs transition ${
                      shortcutsOpen
                        ? "border-accent bg-accent text-page"
                        : "border-ink/10 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
                    }`}
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                  </button>

                  {shortcutsOpen && (
                    <div
                      role="dialog"
                      aria-label="Keyboard shortcuts reference"
                      data-testid="shortcuts-popover"
                      className="absolute bottom-10 right-0 z-40 w-64 rounded-xl border border-ink/15 bg-panel p-3 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.75)]"
                    >
                      <p className="font-semibold text-ink">
                        Keyboard Shortcuts
                      </p>
                      <dl className="mt-2 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-ink-secondary">Play / Pause</dt>
                          <dd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-ink">
                            Space
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-ink-secondary">Seek ±1s / ±5s</dt>
                          <dd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-ink">
                            ← / → (Shift)
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-ink-secondary">
                            Split at playhead
                          </dt>
                          <dd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-ink">
                            S
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-ink-secondary">Undo / Redo</dt>
                          <dd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-ink">
                            Ctrl+Z / Shift+Z
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-ink-secondary">Search cues</dt>
                          <dd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-ink">
                            Ctrl+F
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* MOBILE PANEL SWITCHER */}
          {viewMode === "editor" && (
            <div className="order-2 lg:hidden">
              <StudioTabs
                activeTab={mobileTab}
                onChange={setMobileTab}
                cueCount={cues.length}
                activePresetName={activePresetShortLabel}
                idPrefix="editor"
                onOpenTimeline={openTimelineView}
              />
            </div>
          )}

          {/* =================================================================
              CHILD 2: LEFT COLUMN — TRANSCRIPT (With Follow-Playback + Resume)
             ================================================================= */}
          {viewMode === "editor" && (
            <section
              id="editor-panel-captions"
              role="tabpanel"
              aria-labelledby="editor-tab-captions"
              data-testid="panel-captions"
              className={`order-3 min-w-0 flex-col lg:order-1 ${
                mobileTab === "captions" ? "flex" : "hidden lg:flex"
              }`}
            >
              <div className="flex flex-col rounded-2xl border border-ink/10 bg-panel p-3.5 sm:p-4">
                {/* Transcript Header: Title, Visible Follow Playback Toggle, and Timeline Action */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="text-sm font-semibold tracking-tight text-ink">
                      Transcript
                    </h2>
                    <span className="rounded-md bg-page px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-ink-secondary">
                      {cues.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="follow-playback-toggle"
                      data-follow-state={
                        !followEnabled
                          ? "off"
                          : followSuspended
                            ? "suspended"
                            : "following"
                      }
                      aria-pressed={isActivelyFollowing}
                      onClick={handleToggleFollowPlayback}
                      title="Automatically scroll transcript to keep the active cue visible"
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                        isActivelyFollowing
                          ? "border-accent/55 bg-accent-soft text-accent-hover"
                          : "border-ink/12 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
                      }`}
                    >
                      <LocateFixed className="h-3 w-3" />
                      <span>Follow playback</span>
                    </button>

                    <button
                      ref={openTimelineBtnRef}
                      type="button"
                      data-testid="open-timeline-btn"
                      onClick={openTimelineView}
                      className="hidden items-center gap-1 rounded-lg border border-ink/15 bg-page px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:border-ink/30 lg:inline-flex"
                    >
                      <Clock className="h-3 w-3 text-ink-secondary" />
                      <span>Timeline</span>
                    </button>
                  </div>
                </div>

                {/* Search Input */}
                <div className="flex items-center gap-1.5 rounded-xl border border-ink/10 bg-page px-2.5 py-1.5 focus-within:border-accent">
                  <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    data-testid="transcript-search-input"
                    value={searchQuery}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setSearchQuery(nextVal);
                      setActiveMatchIdx(0);
                      if (nextVal.trim()) {
                        suspendFollowPlayback();
                      }
                      const q = nextVal.trim().toLowerCase();
                      if (q) {
                        const first = cues.find((c) =>
                          c.text.toLowerCase().includes(q)
                        );
                        if (first) {
                          setSelectedCueId(first.id);
                          scrollTranscriptPaneToCue(first.id);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        navigateSearchMatch(e.shiftKey ? -1 : 1);
                      } else if (e.key === "Escape") {
                        setSearchQuery("");
                        setActiveMatchIdx(0);
                      }
                    }}
                    placeholder="Search cues..."
                    aria-label="Search transcript"
                    className="min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none"
                  />

                  {!trimmedQuery ? (
                    <kbd className="hidden rounded bg-panel px-1.5 py-0.5 font-mono text-[10px] text-ink-muted sm:inline-block">
                      Ctrl+F
                    </kbd>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        data-testid="transcript-search-count"
                        className="font-mono text-[11px] tabular-nums text-ink-secondary"
                      >
                        {matchingCueIds.length > 0
                          ? `${boundedMatchIdx + 1}/${matchingCueIds.length}`
                          : "0/0"}
                      </span>
                      <button
                        type="button"
                        data-testid="transcript-search-prev"
                        disabled={matchingCueIds.length === 0}
                        onClick={() => navigateSearchMatch(-1)}
                        aria-label="Previous match"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-ink/10 bg-elevated text-ink-secondary hover:text-ink disabled:opacity-40"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid="transcript-search-next"
                        disabled={matchingCueIds.length === 0}
                        onClick={() => navigateSearchMatch(1)}
                        aria-label="Next match"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-ink/10 bg-elevated text-ink-secondary hover:text-ink disabled:opacity-40"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setActiveMatchIdx(0);
                        }}
                        aria-label="Clear search"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-muted hover:text-ink"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Resume Following Action when suspended by manual scroll, search, or cue edit */}
                {followEnabled && followSuspended && (
                  <div
                    data-testid="follow-suspended-bar"
                    className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-ink/12 bg-inset px-3 py-1.5 text-[11px]"
                  >
                    <span className="text-ink-secondary">
                      Auto-follow paused
                    </span>
                    <button
                      type="button"
                      data-testid="resume-following-btn"
                      onClick={handleResumeFollowing}
                      className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 font-semibold text-page transition hover:bg-accent-hover"
                    >
                      <LocateFixed className="h-3 w-3" />
                      <span>Resume following</span>
                    </button>
                  </div>
                )}

                {cues.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-dashed border-ink/12 bg-page px-4 py-8 text-center text-xs text-ink-muted">
                    No speech cues were detected for this clip.
                  </p>
                ) : (
                  <div
                    ref={transcriptScrollRef}
                    data-testid="transcript-scroll-pane"
                    onScroll={handleTranscriptScroll}
                    onWheel={() => {
                      programmaticScrollUntilRef.current = 0;
                    }}
                    onTouchMove={() => {
                      programmaticScrollUntilRef.current = 0;
                    }}
                    className="studio-scroll relative mt-2.5 max-h-[340px] space-y-2 overflow-y-auto pr-1 sm:max-h-[420px] lg:max-h-[540px] xl:max-h-[610px]"
                  >
                    {cues.map((cue, idx) => {
                      const isActive = activeCue?.id === cue.id;
                      const isSelected = selectedCue?.id === cue.id;
                      const isSearchMatch =
                        Boolean(trimmedQuery) &&
                        matchingCueIds.includes(cue.id);
                      const isCurrentMatch = currentMatchedCueId === cue.id;
                      const hasWordSync =
                        cue.timing_mode === "word" && cue.words.length > 0;
                      const isWordsExpanded =
                        Boolean(expandedWordCueIds[cue.id]) ||
                        editingWord?.cueId === cue.id;
                      const isTimingExpanded = Boolean(
                        expandedTimingCueIds[cue.id]
                      );

                      // COMPACT ROW (unselected): distinct playing state vs selected editing state
                      if (!isSelected) {
                        return (
                          <div
                            key={cue.id}
                            ref={(el) => {
                              cueCardRefs.current[cue.id] = el;
                            }}
                            data-testid={`editor-cue-${idx + 1}`}
                            data-active-cue={isActive ? "true" : "false"}
                            data-selected-cue="false"
                            data-search-match={isSearchMatch ? "true" : "false"}
                            data-timing-mode={cue.timing_mode}
                            onClick={() => {
                              setSelectedCueId(cue.id);
                              seekToMs(cue.start_ms, true);
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.target === e.currentTarget &&
                                (e.key === "Enter" || e.key === " ")
                              ) {
                                e.preventDefault();
                                setSelectedCueId(cue.id);
                                seekToMs(cue.start_ms, true);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className={`group relative flex cursor-pointer items-start justify-between gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                              isCurrentMatch
                                ? "border-accent bg-elevated"
                                : isActive
                                  ? "border-ink/20 bg-elevated/80"
                                  : isSearchMatch
                                    ? "border-ink/20 bg-inset"
                                    : "border-ink/8 bg-page/65 hover:border-ink/20 hover:bg-inset"
                            }`}
                          >
                            {isActive && (
                              <span
                                aria-hidden="true"
                                className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-accent"
                              />
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px] font-medium tabular-nums text-ink-muted">
                                  {formatMsClock(cue.start_ms)}
                                </span>
                                {isActive && (
                                  <span
                                    data-testid={`cue-${idx + 1}-playing-badge`}
                                    className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-hover"
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full bg-accent ${
                                        isPlaying ? "animate-pulse" : ""
                                      }`}
                                    />
                                    <span>
                                      {isPlaying ? "Playing" : "Current"}
                                    </span>
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink">
                                {cue.text}
                              </p>
                            </div>

                            <button
                              type="button"
                              data-testid={`cue-${idx + 1}-play-btn`}
                              aria-label={`Play cue ${idx + 1}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCueId(cue.id);
                                const el = mediaRef.current;
                                if (el) {
                                  playUntilMsRef.current = cue.end_ms;
                                  el.currentTime = cue.start_ms / 1000;
                                  setCurrentTimeMs(cue.start_ms);
                                  void el.play().catch(() => {});
                                }
                              }}
                              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-ink-muted opacity-75 transition hover:bg-panel hover:text-ink group-hover:opacity-100"
                            >
                              <Play className="h-3 w-3 fill-current" />
                            </button>
                          </div>
                        );
                      }

                      // SELECTED EDITING CUE ROW
                      return (
                        <div
                          key={cue.id}
                          ref={(el) => {
                            cueCardRefs.current[cue.id] = el;
                          }}
                          data-testid={`editor-cue-${idx + 1}`}
                          data-active-cue={isActive ? "true" : "false"}
                          data-selected-cue="true"
                          data-search-match={isSearchMatch ? "true" : "false"}
                          data-timing-mode={cue.timing_mode}
                          className="relative overflow-hidden rounded-xl border border-accent bg-elevated p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => seekToMs(cue.start_ms, true)}
                                className="inline-flex items-center gap-1 rounded-lg border border-ink/12 bg-page px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-ink transition hover:border-ink/30"
                              >
                                <span className="text-accent-hover">
                                  #{idx + 1}
                                </span>
                                <span aria-hidden="true" className="opacity-40">
                                  ·
                                </span>
                                <span>
                                  {formatMsClock(cue.start_ms)} –{" "}
                                  {formatMsClock(cue.end_ms)}
                                </span>
                              </button>

                              {isActive && isPlaying && (
                                <span
                                  data-testid={`cue-${idx + 1}-playing-badge`}
                                  className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-hover"
                                >
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                                  <span>Playing</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {hasWordSync ? (
                                <button
                                  type="button"
                                  data-testid={`cue-${idx + 1}-edit-words-btn`}
                                  aria-expanded={isWordsExpanded}
                                  onClick={() =>
                                    setExpandedWordCueIds((prev) => ({
                                      ...prev,
                                      [cue.id]: !prev[cue.id],
                                    }))
                                  }
                                  className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition ${
                                    isWordsExpanded
                                      ? "border-accent bg-accent text-page font-semibold"
                                      : "border-ink/12 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
                                  }`}
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                  <span>
                                    {isWordsExpanded ? "Hide words" : "Edit words"}
                                  </span>
                                </button>
                              ) : (
                                <span className="rounded-md bg-page px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                                  Cue-level
                                </span>
                              )}

                              <button
                                type="button"
                                data-testid={`cue-${idx + 1}-timing-btn`}
                                aria-expanded={isTimingExpanded}
                                onClick={() =>
                                  setExpandedTimingCueIds((prev) => ({
                                    ...prev,
                                    [cue.id]: !prev[cue.id],
                                  }))
                                }
                                className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition ${
                                  isTimingExpanded
                                    ? "border-accent bg-accent text-page font-semibold"
                                    : "border-ink/12 bg-page text-ink-secondary hover:border-ink/25 hover:text-ink"
                                }`}
                              >
                                <Clock className="h-2.5 w-2.5" />
                                <span>Timing</span>
                              </button>

                              <button
                                type="button"
                                data-testid={`cue-${idx + 1}-play-btn`}
                                aria-label={`Play cue ${idx + 1}`}
                                onClick={() => {
                                  const el = mediaRef.current;
                                  if (el) {
                                    playUntilMsRef.current = cue.end_ms;
                                    el.currentTime = cue.start_ms / 1000;
                                    setCurrentTimeMs(cue.start_ms);
                                    void el.play().catch(() => {});
                                  }
                                }}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-ink/12 bg-page text-ink-secondary transition hover:border-ink/25 hover:text-ink"
                              >
                                <Play className="h-3 w-3 fill-current" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-2">
                            <textarea
                              rows={2}
                              aria-label={`Cue ${idx + 1} text`}
                              value={cue.text}
                              onChange={(e) =>
                                updateCueText(cue.id, e.target.value)
                              }
                              className="w-full resize-none rounded-lg border border-ink/15 bg-page px-3 py-2 text-xs leading-relaxed text-ink transition placeholder:text-ink-muted focus:border-accent focus:outline-none"
                            />
                          </div>

                          {hasWordSync && isWordsExpanded && (
                            <div
                              data-testid={`cue-${idx + 1}-word-chips`}
                              aria-label={`Cue ${idx + 1} word timing`}
                              className="mt-2 rounded-lg border border-ink/10 bg-page p-2"
                            >
                              <div className="flex flex-wrap items-center gap-1">
                                {cue.words.map((word, wIdx) => {
                                  const isWordActive =
                                    isActive && activeWord?.id === word.id;
                                  const isWordPast =
                                    isActive && currentTimeMs >= word.end_ms;
                                  const isEditingThisWord =
                                    editingWord?.cueId === cue.id &&
                                    editingWord?.wordId === word.id;

                                  if (isEditingThisWord) {
                                    return (
                                      <span
                                        key={word.id}
                                        className="inline-flex items-center gap-1 rounded-md border border-accent bg-panel px-1 py-0.5"
                                      >
                                        <input
                                          type="text"
                                          autoFocus
                                          data-testid="inline-word-input"
                                          aria-label={`Edit word ${wIdx + 1} in cue ${idx + 1}`}
                                          value={editingWord.draft}
                                          onChange={(e) => {
                                            suspendFollowPlayback();
                                            setEditingWord({
                                              ...editingWord,
                                              draft: e.target.value,
                                            });
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              commitInlineWordEdit();
                                            } else if (e.key === "Escape") {
                                              e.preventDefault();
                                              setEditingWord(null);
                                            }
                                          }}
                                          className="w-24 bg-transparent text-xs font-semibold text-ink focus:outline-none"
                                        />
                                        <button
                                          type="button"
                                          data-testid="inline-word-save-btn"
                                          aria-label="Save word edit"
                                          onClick={commitInlineWordEdit}
                                          className="inline-flex h-5 w-5 items-center justify-center rounded bg-accent text-page"
                                        >
                                          <Check className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          aria-label="Cancel word edit"
                                          onClick={() => setEditingWord(null)}
                                          className="inline-flex h-5 w-5 items-center justify-center rounded text-ink-muted hover:text-ink"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    );
                                  }

                                  return (
                                    <span
                                      key={word.id}
                                      className="inline-flex items-center"
                                    >
                                      <button
                                        type="button"
                                        data-testid={`cue-${idx + 1}-word-${wIdx + 1}`}
                                        data-active-word={
                                          isWordActive ? "true" : "false"
                                        }
                                        onClick={() =>
                                          seekToMs(word.start_ms, true)
                                        }
                                        onDoubleClick={() => {
                                          suspendFollowPlayback();
                                          setEditingWord({
                                            cueId: cue.id,
                                            wordId: word.id,
                                            draft: word.text,
                                          });
                                        }}
                                        title={`Seek to ${formatMsClock(word.start_ms)} (double-click to edit)`}
                                        className={`rounded-md px-1.5 py-0.5 text-xs transition ${
                                          isWordActive
                                            ? "bg-accent font-semibold text-page"
                                            : isWordPast
                                              ? "bg-track/70 text-ink"
                                              : "text-ink-secondary hover:bg-elevated hover:text-ink"
                                        }`}
                                      >
                                        {word.text}
                                      </button>
                                      {isWordActive && (
                                        <button
                                          type="button"
                                          data-testid={`edit-active-word-btn-${idx + 1}`}
                                          aria-label={`Edit timed word ${word.text}`}
                                          onClick={() => {
                                            suspendFollowPlayback();
                                            setEditingWord({
                                              cueId: cue.id,
                                              wordId: word.id,
                                              draft: word.text,
                                            });
                                          }}
                                          className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded bg-elevated text-ink-secondary hover:bg-accent hover:text-page"
                                        >
                                          <Pencil className="h-2.5 w-2.5" />
                                        </button>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                              <p className="mt-1.5 text-[10px] text-ink-muted">
                                Click word to seek · Double-click word to edit
                              </p>
                            </div>
                          )}

                          {isTimingExpanded && (
                            <div
                              data-testid={`cue-${idx + 1}-timing-panel`}
                              className="mt-2 space-y-2 rounded-lg border border-ink/10 bg-page p-2"
                            >
                              <div className="grid grid-cols-2 gap-2">
                                <label className="flex items-center justify-between gap-2 rounded-lg border border-ink/12 bg-panel px-2.5 py-1 text-[11px] text-ink-muted focus-within:border-accent">
                                  <span className="shrink-0 font-medium">
                                    Start (s)
                                  </span>
                                  <input
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    max={(clipDurationMs / 1000).toFixed(2)}
                                    aria-label={`Cue ${idx + 1} start seconds`}
                                    value={(cue.start_ms / 1000).toFixed(2)}
                                    onChange={(e) =>
                                      updateCueTiming(
                                        cue.id,
                                        "start_ms",
                                        e.target.value
                                      )
                                    }
                                    className="w-16 bg-transparent text-right font-mono text-xs tabular-nums text-ink focus:outline-none"
                                  />
                                </label>

                                <label className="flex items-center justify-between gap-2 rounded-lg border border-ink/12 bg-panel px-2.5 py-1 text-[11px] text-ink-muted focus-within:border-accent">
                                  <span className="shrink-0 font-medium">
                                    End (s)
                                  </span>
                                  <input
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    max={(clipDurationMs / 1000).toFixed(2)}
                                    aria-label={`Cue ${idx + 1} end seconds`}
                                    value={(cue.end_ms / 1000).toFixed(2)}
                                    onChange={(e) =>
                                      updateCueTiming(
                                        cue.id,
                                        "end_ms",
                                        e.target.value
                                      )
                                    }
                                    className="w-16 bg-transparent text-right font-mono text-xs tabular-nums text-ink focus:outline-none"
                                  />
                                </label>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-ink-muted">
                                  Duration:{" "}
                                  {(
                                    (cue.end_ms - cue.start_ms) /
                                    1000
                                  ).toFixed(2)}
                                  s
                                </span>
                                <button
                                  type="button"
                                  onClick={openTimelineView}
                                  className="font-medium text-accent-hover transition hover:underline"
                                >
                                  Adjust on waveform →
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="mt-2.5 text-[11px] text-ink-muted">
                  {isSampleMode
                    ? "Sample edits stay local in your browser. Download an SRT anytime."
                    : "Select a cue to seek and edit inline. Changes autosave automatically."}
                </p>
              </div>
            </section>
          )}

          {/* =================================================================
              CHILD 3: RIGHT COLUMN — COMPACT PRESETS GALLERY & STYLE
             ================================================================= */}
          {viewMode === "editor" && (
            <aside
              id="editor-panel-style"
              role="tabpanel"
              aria-labelledby="editor-tab-style"
              data-testid="panel-style"
              className={`studio-scroll order-4 min-w-0 flex-col lg:order-3 lg:max-h-[680px] lg:overflow-y-auto lg:pr-1 ${
                mobileTab === "style" ? "flex" : "hidden lg:flex"
              }`}
            >
              <StudioStylePanel
                style={style}
                onUpdateStyle={updateStyle}
                subtitle={isSampleMode ? "Local preview" : "Live preview"}
                showSafeArea={showSafeArea}
                onToggleSafeArea={setShowSafeArea}
                enablePersonalPresets={!isSampleMode}
                personalPresets={personalPresets}
                onPersonalPresetsChange={setPersonalPresets}
              />
            </aside>
          )}

          {/* =================================================================
              CHILD 4: FOCUSED FULL-WIDTH TIMELINE + NUMERIC TIMING INSPECTOR
             ================================================================= */}
          {viewMode === "timeline" && (
            <section
              aria-label="Focused caption timeline"
              data-testid="focused-timeline-view"
              className="order-2 flex min-w-0 flex-col gap-2.5"
            >
              <EditorTimeline
                cues={cues}
                style={style}
                durationMs={clipDurationMs}
                currentTimeMs={currentTimeMs}
                activeCueId={activeCue?.id ?? null}
                selectedCueId={selectedCue?.id ?? null}
                audioSourceUrl={previewUrl}
                onSeekMs={seekToMs}
                onSelectCue={handleSelectTimelineCue}
                onPreviewCuesChange={handleTimelinePreviewCues}
                onCommitCuesChange={handleTimelineCommitCues}
                onSplitAtPlayhead={handleSplitAtPlayhead}
                canSplitAtPlayhead={canSplitAtPlayhead}
                onMergeSelectedWithNext={handleMergeSelectedWithNext}
                canMergeSelected={canMergeSelected}
                onPlaySelectedCue={() => void playSelectedCue()}
                canPlaySelectedCue={Boolean(selectedCue)}
              />

              {selectedCue && (
                <div
                  data-testid="timeline-selected-cue-inspector"
                  className="rounded-2xl border border-ink/10 bg-panel p-3 sm:px-4 sm:py-3"
                >
                  <div className="grid grid-cols-1 items-center gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 rounded-lg bg-inset px-2 py-1 font-mono text-xs font-semibold text-ink">
                        Cue #{Math.max(1, effectiveSelectedIndex + 1)}
                      </span>
                      <input
                        type="text"
                        aria-label="Selected timeline cue text"
                        value={selectedCue.text}
                        onChange={(e) =>
                          updateCueText(selectedCue.id, e.target.value)
                        }
                        className="min-w-0 flex-1 rounded-xl border border-ink/12 bg-page px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                      <label className="flex items-center justify-between gap-2 rounded-xl border border-ink/12 bg-page px-2.5 py-1.5 text-xs text-ink-muted focus-within:border-accent">
                        <span className="font-medium">Start (s)</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max={(clipDurationMs / 1000).toFixed(2)}
                          data-testid="timeline-start-seconds-input"
                          aria-label="Selected cue start seconds"
                          value={(selectedCue.start_ms / 1000).toFixed(2)}
                          onChange={(e) =>
                            updateCueTiming(
                              selectedCue.id,
                              "start_ms",
                              e.target.value
                            )
                          }
                          className="w-16 bg-transparent text-right font-mono text-xs tabular-nums text-ink focus:outline-none"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-2 rounded-xl border border-ink/12 bg-page px-2.5 py-1.5 text-xs text-ink-muted focus-within:border-accent">
                        <span className="font-medium">End (s)</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max={(clipDurationMs / 1000).toFixed(2)}
                          data-testid="timeline-end-seconds-input"
                          aria-label="Selected cue end seconds"
                          value={(selectedCue.end_ms / 1000).toFixed(2)}
                          onChange={(e) =>
                            updateCueTiming(
                              selectedCue.id,
                              "end_ms",
                              e.target.value
                            )
                          }
                          className="w-16 bg-transparent text-right font-mono text-xs tabular-nums text-ink focus:outline-none"
                        />
                      </label>

                      <span className="hidden rounded-lg bg-inset px-2 py-1.5 font-mono text-[11px] tabular-nums text-ink-secondary sm:inline-block">
                        {(
                          (selectedCue.end_ms - selectedCue.start_ms) /
                          1000
                        ).toFixed(2)}
                        s
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {!isSampleMode && projectId && (
        <ProjectExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          projectId={projectId}
          projectTitle={projectTitle}
          mediaKind={mediaKind}
          savedRevisionId={savedRevisionId}
          savedRevisionNumber={revisionNumber}
          hasUnsavedChanges={saveStatus !== "saved"}
          saveStatus={saveStatus}
        />
      )}
    </div>
  );
}
