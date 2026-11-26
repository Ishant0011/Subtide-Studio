"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Captions,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Frame,
  Keyboard,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Pencil,
  Play,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Search,
  SlidersHorizontal,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
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
import { EditorCaptionOverlay } from "@/components/EditorCaptionOverlay";
import { EditorTimeline } from "@/components/EditorTimeline";
import { ProjectExportModal } from "@/components/ProjectExportModal";
import { StudioStylePanel } from "@/components/StudioStylePanel";
import { StudioTabs, type StudioMobileTab } from "@/components/StudioTabs";

type SaveStatus = "saved" | "saving" | "error" | "conflict";

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
  userEmail: string;
  projectId: string;
  projectTitle: string;
  mediaKind: "video" | "audio";
  previewUrl: string;
  previewWidth?: number | null;
  previewHeight?: number | null;
  durationMs: number;
  initialRevisionId: string | null;
  initialRevisionNumber: number;
  initialCues: EditorCue[];
  initialStyle: CaptionStyleConfig;
  initialPresets?: SavedCaptionPresetRow[];
}

const MAX_HISTORY_DEPTH = 50;

export function ProjectCaptionEditor({
  userEmail,
  projectId,
  projectTitle,
  mediaKind,
  previewUrl,
  previewWidth = null,
  previewHeight = null,
  durationMs,
  initialRevisionId,
  initialRevisionNumber,
  initialCues,
  initialStyle,
  initialPresets = [],
}: ProjectCaptionEditorProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutsRef = useRef<HTMLDivElement | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const cueCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const playUntilMsRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
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
  // Shared inspector tab across desktop inspector & phone tabs
  const [inspectorTab, setInspectorTab] = useState<StudioMobileTab>("captions");
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mobilePreviewExpanded, setMobilePreviewExpanded] = useState(false);
  const [expandedWordCueIds, setExpandedWordCueIds] = useState<
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
    if (mediaKind === "audio") return "Audio 9:16";
    if (!videoDims) return "Video";
    if (videoDims.w > videoDims.h) return "Video 16:9";
    if (videoDims.w === videoDims.h) return "Video 1:1";
    return "Video 9:16";
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
    selectedCueIndex >= 0 ? cues[selectedCueIndex] : activeCue;

  const activePresetShortLabel = useMemo(() => {
    if (style.preset === "word-highlight") return "Highlight";
    if (style.preset === "boxed") return "Boxed";
    return "Clean";
  }, [style.preset]);

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
    (nextMs: number) => {
      playUntilMsRef.current = null;
      const clamped = Math.max(0, Math.min(clipDurationMs, Math.round(nextMs)));
      const el = mediaRef.current;
      if (el) {
        el.currentTime = clamped / 1000;
      }
      setCurrentTimeMs(clamped);
    },
    [clipDurationMs]
  );

  const scrollCueCardIntoContainer = useCallback((cueId: string) => {
    const container = transcriptScrollRef.current;
    const card = cueCardRefs.current[cueId];
    if (!container || !card) return;

    const cardTop = card.offsetTop;
    const cardBottom = cardTop + card.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    if (cardTop < viewTop + 12 || cardBottom > viewBottom - 12) {
      container.scrollTo({
        top: Math.max(0, cardTop - 24),
        behavior: "smooth",
      });
    }
  }, []);

  const togglePlay = useCallback(async () => {
    playUntilMsRef.current = null;
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      if (el.ended || el.currentTime * 1000 >= clipDurationMs - 50) {
        el.currentTime = 0;
        setCurrentTimeMs(0);
      }
      try {
        await el.play();
      } catch {
        el.muted = true;
        setIsMuted(true);
        await el.play().catch(() => {});
      }
    } else {
      el.pause();
    }
  }, [clipDurationMs]);

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
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setClipDurationMs(Math.round(el.duration * 1000));
    }
    if (el instanceof HTMLVideoElement && el.videoWidth > 0 && el.videoHeight > 0) {
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
    if (inFlightRef.current) return;

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
  }, [clipDurationMs, projectId, setSaveStatusSynced]);

  const scheduleAutosave = useCallback(() => {
    localVersionRef.current += 1;
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
  }, [performSave, setSaveStatusSynced]);

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
    const res = splitCueAtTimeMs(latestCuesRef.current, target.id, currentTimeMs);
    if (!res.ok) {
      flashNotice(res.error);
      return;
    }
    // Single undoable action
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
    // Single undoable action
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
  }, [editingWord, recordUndoSnapshot, scheduleAutosave]);

  // Keyboard shortcuts safely scoped around active typing
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isSearchField = target === searchInputRef.current;
      const isMod = event.ctrlKey || event.metaKey;

      if (isMod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setInspectorTab("captions");
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
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
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    currentTimeMs,
    handleRedo,
    handleSplitAtPlayhead,
    handleUndo,
    seekToMs,
    togglePlay,
  ]);

  const navigateSearchMatch = useCallback(
    (direction: 1 | -1) => {
      if (matchingCueIds.length === 0) return;
      const nextIdx =
        (boundedMatchIdx + direction + matchingCueIds.length) %
        matchingCueIds.length;
      const targetId = matchingCueIds[nextIdx];
      setActiveMatchIdx(nextIdx);
      setSelectedCueId(targetId);
      const found = cues.find((c) => c.id === targetId);
      if (found) {
        seekToMs(found.start_ms);
        scrollCueCardIntoContainer(found.id);
      }
    },
    [boundedMatchIdx, cues, matchingCueIds, scrollCueCardIntoContainer, seekToMs]
  );

  const handleSelectTimelineCue = useCallback(
    (cueId: string, startMs: number) => {
      setSelectedCueId(cueId);
      seekToMs(startMs);
      const activeTag = document.activeElement?.tagName;
      if (activeTag !== "TEXTAREA" && activeTag !== "INPUT") {
        scrollCueCardIntoContainer(cueId);
      }
    },
    [scrollCueCardIntoContainer, seekToMs]
  );

  const handleTimelinePreviewCues = useCallback((nextCues: EditorCue[]) => {
    latestCuesRef.current = nextCues;
    setCues(nextCues);
  }, []);

  const handleTimelineCommitCues = useCallback(
    (beforeCues: EditorCue[], afterCues: EditorCue[]) => {
      recordUndoSnapshot({ cues: beforeCues, style: latestStyleRef.current });
      latestCuesRef.current = afterCues;
      setCues(afterCues);
      scheduleAutosave();
    },
    [recordUndoSnapshot, scheduleAutosave]
  );

  const updateCueText = (cueId: string, nextText: string) => {
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
    secondsStr: string
  ) => {
    const parsedSec = Number.parseFloat(secondsStr);
    if (!Number.isFinite(parsedSec)) return;
    const nextMs = Math.round(parsedSec * 1000);

    recordUndoSnapshot(
      { cues: latestCuesRef.current, style: latestStyleRef.current },
      `timing:${cueId}:${field}`
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

  return (
    <div className="min-h-screen overflow-x-clip bg-page text-ink">
      {/* Compact Project Header */}
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-page/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-1.5 sm:flex-nowrap sm:gap-3 sm:px-5 sm:py-2.5 lg:px-6">
          <Link
            href="/projects"
            className="order-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink/12 bg-panel px-2 py-1 text-xs font-medium text-ink-secondary transition hover:border-accent/55 hover:text-ink sm:gap-1.5 sm:px-2.5 sm:py-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Projects</span>
          </Link>

          <div className="order-3 flex w-full min-w-0 items-center justify-between gap-2 sm:order-2 sm:w-auto sm:flex-1 sm:justify-start">
            <span
              aria-hidden="true"
              className="hidden h-4 w-px shrink-0 bg-ink/12 sm:inline-block"
            />
            <h1 className="truncate text-xs font-bold tracking-tight text-ink sm:text-sm lg:text-base">
              {projectTitle}
            </h1>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-full border border-ink/10 bg-panel px-2 py-0.5 font-mono text-[10px] tabular-nums text-ink-secondary sm:text-[11px]">
                Rev #{revisionNumber}
              </span>
              <span
                data-testid="editor-media-aspect"
                className="hidden rounded-full border border-accent/35 bg-accent-soft/80 px-2 py-0.5 text-[11px] font-medium text-accent-hover sm:inline-block"
              >
                {mediaAspectBadge}
              </span>
            </div>
          </div>

          <div className="order-2 flex shrink-0 items-center gap-1.5 sm:order-3 sm:gap-2">
            <div className="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                data-testid="editor-undo-btn"
                disabled={historyCounts.undo === 0}
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink/12 bg-panel text-ink-secondary transition hover:border-accent/55 hover:text-ink disabled:opacity-35"
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink/12 bg-panel text-ink-secondary transition hover:border-accent/55 hover:text-ink disabled:opacity-35"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <span
              role="status"
              aria-live="polite"
              data-testid="autosave-status"
              data-status={saveStatus}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold sm:gap-1.5 sm:px-3 sm:text-xs ${
                saveStatus === "saved"
                  ? "border border-accent/40 bg-accent-soft text-accent-hover"
                  : saveStatus === "saving"
                    ? "border border-amber-400/35 bg-amber-400/10 text-amber-200"
                    : "border border-rose-400/35 bg-rose-500/10 text-rose-200"
              }`}
            >
              {saveStatus === "saving" && (
                <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
              )}
              {saveStatus === "saved" && (
                <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              )}
              {saveStatus === "error" && (
                <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              )}
              {saveStatus === "conflict" && (
                <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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
                className="inline-flex items-center gap-1 rounded-lg border border-ink/15 bg-elevated px-2.5 py-1 text-xs font-medium text-ink transition hover:border-accent/55"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry</span>
              </button>
            )}

            <button
              type="button"
              data-testid="open-export-btn"
              onClick={() => setExportModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-page transition hover:bg-accent-hover sm:gap-1.5 sm:px-3 sm:py-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>

            <AccountMenu userEmail={userEmail} compactMobile />
          </div>
        </div>
      </header>

      {/* Main Creator Studio Workspace */}
      <main className="mx-auto w-full max-w-[1440px] px-3 py-2.5 sm:px-5 lg:px-6 lg:py-2.5">
        {/* Action Toast */}
        {actionNotice && (
          <div
            role="status"
            data-testid="editor-action-notice"
            className="mb-2.5 rounded-xl border border-accent/35 bg-accent-soft px-3.5 py-2 text-xs font-medium text-accent-hover"
          >
            {actionNotice}
          </div>
        )}

        {/* Conflict Banner */}
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
                  Your local edits have been preserved. Choose whether to reload
                  the latest revision or save your edits as a new revision.
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
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-300/30 bg-panel px-2.5 py-1 text-xs font-semibold text-rose-100 hover:border-accent/55"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry save</span>
                </button>
              )}
            </div>
          )}

        {/* Top Row: Centered Video Stage + Right Transcript/Style Inspector */}
        <div className="grid grid-cols-1 gap-2.5 sm:gap-3.5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-5">
          {/* Centered Preview Stage + Transport Bar */}
          <section
            aria-label="Caption preview and playback"
            className="flex min-w-0 flex-col"
          >
            <div className="relative flex items-center justify-center rounded-2xl border border-ink/10 bg-inset px-3 py-2 sm:px-6 sm:py-3 lg:py-2.5">
              {/* Mobile Expand / Collapse Preview Toggle */}
              <button
                type="button"
                data-testid="toggle-expand-preview-btn"
                aria-expanded={mobilePreviewExpanded}
                onClick={() => setMobilePreviewExpanded((v) => !v)}
                className="absolute left-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-lg border border-ink/12 bg-page/85 px-2 py-1 text-[10px] font-semibold text-ink-secondary transition hover:border-accent/45 hover:text-ink lg:hidden"
              >
                {mobilePreviewExpanded ? (
                  <>
                    <Minimize2 className="h-3 w-3 text-accent" />
                    <span>Collapse</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3 w-3 text-accent" />
                    <span>Expand preview</span>
                  </>
                )}
              </button>

              {/* Quick Safe-Area Guide Button on Stage */}
              <button
                type="button"
                onClick={() => setShowSafeArea((v) => !v)}
                aria-pressed={showSafeArea}
                title="Toggle Reels/Shorts safe-area guide"
                className={`absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition sm:right-3 sm:top-3 ${
                  showSafeArea
                    ? "border-accent bg-accent-soft text-accent-hover"
                    : "border-ink/12 bg-page/80 text-ink-secondary hover:border-accent/45 hover:text-ink"
                }`}
              >
                <Frame className="h-3 w-3" />
                <span className="hidden sm:inline">Safe area</span>
              </button>

              <div
                data-testid="editor-preview-stage"
                data-orientation={isLandscapeVideo ? "landscape" : "portrait"}
                data-mobile-expanded={mobilePreviewExpanded ? "true" : "false"}
                className={`studio-stage-container relative overflow-hidden rounded-[1.25rem] border border-ink/12 bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.65)] transition-[width,max-width] duration-200 sm:rounded-[1.35rem] ${
                  isLandscapeVideo
                    ? mobilePreviewExpanded
                      ? "aspect-video w-full max-w-[360px] sm:max-w-[540px] lg:max-w-[680px]"
                      : "aspect-video w-full max-w-[270px] sm:max-w-[540px] lg:max-w-[680px]"
                    : mobilePreviewExpanded
                      ? "aspect-[9/16] w-[232px] sm:w-[252px] lg:w-[248px] xl:w-[252px] 2xl:w-[288px]"
                      : "aspect-[9/16] w-[124px] sm:w-[228px] lg:w-[248px] xl:w-[252px] 2xl:w-[288px]"
                }`}
              >
                {mediaKind === "video" ? (
                  <video
                    ref={(el) => {
                      mediaRef.current = el;
                    }}
                    src={previewUrl}
                    playsInline
                    preload="auto"
                    muted={isMuted}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onSeeked={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onClick={() => void togglePlay()}
                    className="h-full w-full cursor-pointer bg-page object-contain"
                  />
                ) : (
                  <div
                    data-testid="editor-audio-stage"
                    onClick={() => void togglePlay()}
                    className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center bg-gradient-to-b from-[#1A1530] via-[#11121F] to-page p-5 text-center"
                  >
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/40 bg-accent-soft text-accent shadow-[0_0_24px_rgba(167,139,250,0.24)]">
                      <AudioLines className="h-7 w-7" />
                    </span>
                    <p className="mt-3 max-w-full truncate text-xs font-semibold text-ink">
                      {projectTitle}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      Audio portrait stage
                    </p>
                    <audio
                      ref={(el) => {
                        mediaRef.current = el;
                      }}
                      src={previewUrl}
                      preload="auto"
                      muted={isMuted}
                      onLoadedMetadata={handleLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      onSeeked={handleTimeUpdate}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />
                  </div>
                )}

                {/* Safe-area guide overlay (social UI exclusion zones) */}
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

                <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-full border border-ink/15 bg-page/70 px-2 py-0.5 text-[10px] font-medium text-ink/90 backdrop-blur-md">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isPlaying ? "animate-pulse bg-accent" : "bg-ink-secondary"
                    }`}
                  />
                  <span>{isPlaying ? "Playing" : "Paused"}</span>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-page/85 via-page/30 to-transparent" />

                <EditorCaptionOverlay
                  activeCue={activeCue}
                  activeWord={activeWord}
                  style={style}
                  currentTimeMs={currentTimeMs}
                />

                {!isPlaying && (
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-1/2 top-[54%] z-10 h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent/55 bg-page/75 text-accent shadow-xl backdrop-blur-md ${
                      mobilePreviewExpanded ? "flex" : "hidden sm:flex"
                    }`}
                  >
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  </div>
                )}
              </div>
            </div>

            {/* Centered Transport Bar directly under Preview */}
            <div className="mt-2 rounded-2xl border border-ink/10 bg-panel px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    ref={playButtonRef}
                    type="button"
                    data-testid="play-pause-btn"
                    onClick={() => void togglePlay()}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-page transition hover:bg-accent-hover"
                  >
                    {isPlaying ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => seekToMs(currentTimeMs - 2000)}
                    aria-label="Rewind 2 seconds"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-ink/10 bg-elevated text-ink-secondary transition hover:border-accent/50 hover:text-ink"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => seekToMs(currentTimeMs + 2000)}
                    aria-label="Forward 2 seconds"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-ink/10 bg-elevated text-ink-secondary transition hover:border-accent/50 hover:text-ink"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-ink/10 bg-elevated text-ink-secondary transition hover:border-accent/50 hover:text-ink"
                  >
                    {isMuted ? (
                      <VolumeX className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    data-testid="editor-time-readout"
                    className="font-mono text-xs font-semibold tabular-nums text-ink-secondary"
                  >
                    <span className="text-ink">
                      {formatMsClock(currentTimeMs)}
                    </span>
                    <span className="mx-1 text-ink-muted">/</span>
                    <span>{formatMsClock(clipDurationMs)}</span>
                  </div>

                  {activeWord && (
                    <span
                      data-testid="active-word-readout"
                      className="hidden max-w-[100px] truncate rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-hover sm:inline-block"
                    >
                      {activeWord.text}
                    </span>
                  )}

                  <span
                    data-testid="active-cue-indicator"
                    className={`hidden truncate rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums sm:inline-block ${
                      activeCueIndex >= 0
                        ? "border border-accent/35 bg-accent-soft text-accent-hover"
                        : "border border-ink/10 bg-elevated text-ink-muted"
                    }`}
                  >
                    {activeCueIndex >= 0
                      ? `Cue #${activeCueIndex + 1}/${cues.length}`
                      : `${cues.length} cues`}
                  </span>

                  {/* Discoverable Shortcuts Popover */}
                  <div ref={shortcutsRef} className="relative">
                    <button
                      type="button"
                      data-testid="shortcuts-toggle-btn"
                      aria-expanded={shortcutsOpen}
                      aria-label="Keyboard shortcuts"
                      onClick={() => setShortcutsOpen((prev) => !prev)}
                      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium transition ${
                        shortcutsOpen
                          ? "border-accent bg-accent-soft text-accent-hover"
                          : "border-ink/12 bg-elevated text-ink-secondary hover:border-accent/50 hover:text-ink"
                      }`}
                    >
                      <Keyboard className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Shortcuts</span>
                    </button>

                    {shortcutsOpen && (
                      <div
                        role="dialog"
                        aria-label="Keyboard shortcuts reference"
                        data-testid="shortcuts-popover"
                        className="absolute bottom-10 right-0 z-40 w-64 rounded-xl border border-ink/15 bg-panel p-3 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.75)]"
                      >
                        <p className="font-semibold text-ink">
                          Playback &amp; Edit Shortcuts
                        </p>
                        <dl className="mt-2 space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-ink-secondary">Play / Pause</dt>
                            <dd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-accent-hover">
                              Space
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-ink-secondary">Seek ±1s / ±5s</dt>
                            <dd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-accent-hover">
                              ← / → (Shift)
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-ink-secondary">Split at playhead</dt>
                            <dd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-accent-hover">
                              S
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-ink-secondary">Undo / Redo</dt>
                            <dd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-accent-hover">
                              Ctrl+Z / Shift+Z
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-ink-secondary">Search cues</dt>
                            <dd className="rounded bg-elevated px-1.5 py-0.5 font-mono text-accent-hover">
                              Ctrl+F
                            </dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Right Side Unified Inspector: Transcript / Style Tabs */}
          <aside className="flex min-w-0 flex-col">
            {/* Mobile accessible tabs */}
            <div className="mb-2.5 lg:hidden">
              <StudioTabs
                activeTab={inspectorTab}
                onChange={setInspectorTab}
                cueCount={cues.length}
                activePresetName={activePresetShortLabel}
                idPrefix="editor"
              />
            </div>

            {/* Desktop Inspector Switcher (Transcript | Style) */}
            <div
              role="tablist"
              aria-label="Inspector sections"
              className="mb-2.5 hidden grid-cols-2 gap-1.5 rounded-2xl border border-ink/10 bg-panel p-1 lg:grid"
            >
              <button
                type="button"
                role="tab"
                data-testid="inspector-tab-captions"
                aria-selected={inspectorTab === "captions"}
                onClick={() => setInspectorTab("captions")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition ${
                  inspectorTab === "captions"
                    ? "bg-accent-soft text-accent-hover ring-1 ring-accent/40"
                    : "text-ink-secondary hover:bg-elevated hover:text-ink"
                }`}
              >
                <Captions className="h-3.5 w-3.5" />
                <span>Transcript</span>
                <span className="rounded-full bg-page/60 px-1.5 py-0.5 font-mono text-[10px]">
                  {cues.length}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                data-testid="inspector-tab-style"
                aria-selected={inspectorTab === "style"}
                onClick={() => setInspectorTab("style")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition ${
                  inspectorTab === "style"
                    ? "bg-accent-soft text-accent-hover ring-1 ring-accent/40"
                    : "text-ink-secondary hover:bg-elevated hover:text-ink"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Style &amp; Presets</span>
              </button>
            </div>

            {/* Transcript Panel */}
            <section
              id="editor-panel-captions"
              role="tabpanel"
              aria-labelledby="editor-tab-captions"
              data-testid="panel-captions"
              className={`min-w-0 flex-col ${
                inspectorTab === "captions" ? "flex" : "hidden"
              }`}
            >
              <div className="flex flex-col rounded-2xl border border-ink/10 bg-panel p-3.5 sm:p-4">
                <div className="flex items-center justify-between gap-2 border-b border-ink/8 pb-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft text-accent">
                      <Captions className="h-3.5 w-3.5" />
                    </span>
                    <h2 className="truncate text-sm font-semibold tracking-tight text-ink">
                      Transcript
                    </h2>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {/* Mobile Undo/Redo (Split & Merge live in the Timeline toolbar) */}
                    <div className="flex items-center gap-1 sm:hidden">
                      <button
                        type="button"
                        disabled={historyCounts.undo === 0}
                        onClick={handleUndo}
                        aria-label="Undo"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink/10 bg-elevated text-ink-secondary disabled:opacity-35"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={historyCounts.redo === 0}
                        onClick={handleRedo}
                        aria-label="Redo"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink/10 bg-elevated text-ink-secondary disabled:opacity-35"
                      >
                        <Redo2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Transcript Search Bar */}
                <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-ink/10 bg-page px-2.5 py-1.5 focus-within:border-accent">
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
                      const q = nextVal.trim().toLowerCase();
                      if (q) {
                        const first = cues.find((c) =>
                          c.text.toLowerCase().includes(q)
                        );
                        if (first) {
                          setSelectedCueId(first.id);
                          scrollCueCardIntoContainer(first.id);
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
                    placeholder="Search transcript..."
                    aria-label="Search transcript"
                    className="min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none"
                  />

                  {trimmedQuery && (
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
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-ink/10 bg-elevated text-ink-secondary hover:border-accent/50 hover:text-ink disabled:opacity-40"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid="transcript-search-next"
                        disabled={matchingCueIds.length === 0}
                        onClick={() => navigateSearchMatch(1)}
                        aria-label="Next match"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-ink/10 bg-elevated text-ink-secondary hover:border-accent/50 hover:text-ink disabled:opacity-40"
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

                {cues.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-dashed border-ink/12 bg-page px-4 py-8 text-center text-xs text-ink-muted">
                    No speech cues were detected for this clip.
                  </p>
                ) : (
                  <div
                    ref={transcriptScrollRef}
                    className="studio-scroll relative mt-2.5 space-y-2.5 lg:max-h-[385px] lg:overflow-y-auto lg:pr-1 xl:max-h-[455px]"
                  >
                    {cues.map((cue, idx) => {
                      const isActive = activeCue?.id === cue.id;
                      const isSelected = selectedCueId === cue.id;
                      const isSearchMatch =
                        Boolean(trimmedQuery) && matchingCueIds.includes(cue.id);
                      const isCurrentMatch = currentMatchedCueId === cue.id;
                      const hasWordSync =
                        cue.timing_mode === "word" && cue.words.length > 0;
                      const isWordsExpanded =
                        Boolean(expandedWordCueIds[cue.id]) ||
                        editingWord?.cueId === cue.id;

                      return (
                        <div
                          key={cue.id}
                          ref={(el) => {
                            cueCardRefs.current[cue.id] = el;
                          }}
                          data-testid={`editor-cue-${idx + 1}`}
                          data-active-cue={isActive ? "true" : "false"}
                          data-selected-cue={isSelected ? "true" : "false"}
                          data-search-match={isSearchMatch ? "true" : "false"}
                          data-search-current={isCurrentMatch ? "true" : "false"}
                          data-timing-mode={cue.timing_mode}
                          onClick={() => setSelectedCueId(cue.id)}
                          className={`relative overflow-hidden rounded-xl border p-3 transition ${
                            isCurrentMatch
                              ? "border-accent bg-elevated ring-1 ring-accent/55"
                              : isActive
                                ? "border-accent/60 bg-elevated shadow-[0_8px_24px_rgba(0,0,0,0.32)]"
                                : isSelected
                                  ? "border-accent/40 bg-elevated/60"
                                  : isSearchMatch
                                    ? "border-accent/35 bg-inset"
                                    : "border-ink/10 bg-inset hover:border-ink/20"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute bottom-2.5 left-0 top-2.5 w-1 rounded-r-full transition ${
                              isActive || isCurrentMatch
                                ? "bg-accent"
                                : "bg-transparent"
                            }`}
                          />

                          {/* Timestamp + Quick Cue Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pl-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCueId(cue.id);
                                seekToMs(cue.start_ms);
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-xs font-medium tabular-nums transition ${
                                isActive
                                  ? "border-accent/45 bg-accent-soft text-accent-hover"
                                  : "border-ink/10 bg-page text-ink-secondary hover:border-accent/45 hover:text-ink"
                              }`}
                            >
                              <span className="font-semibold">#{idx + 1}</span>
                              <span aria-hidden="true" className="opacity-50">
                                ·
                              </span>
                              <span>
                                {formatMsClock(cue.start_ms)} –{" "}
                                {formatMsClock(cue.end_ms)}
                              </span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              {hasWordSync && (
                                <button
                                  type="button"
                                  data-testid={`cue-${idx + 1}-edit-words-btn`}
                                  aria-expanded={isWordsExpanded}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCueId(cue.id);
                                    setExpandedWordCueIds((prev) => ({
                                      ...prev,
                                      [cue.id]: !prev[cue.id],
                                    }));
                                  }}
                                  className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold transition ${
                                    isWordsExpanded
                                      ? "border-accent bg-accent-soft text-accent-hover"
                                      : "border-ink/12 bg-page text-ink-secondary hover:border-accent/50 hover:text-ink"
                                  }`}
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                  <span>
                                    {isWordsExpanded
                                      ? "Hide words"
                                      : "Edit words"}
                                  </span>
                                </button>
                              )}
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
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-ink/10 bg-page text-ink-secondary transition hover:border-accent/50 hover:text-accent-hover"
                              >
                                <Play className="h-3 w-3 fill-current" />
                              </button>
                              {!hasWordSync && (
                                <span className="rounded-full bg-track px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
                                  Cue-level
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Editable Caption Text (shown cleanly by default) */}
                          <div className="mt-2 pl-1">
                            <textarea
                              rows={2}
                              aria-label={`Cue ${idx + 1} text`}
                              value={cue.text}
                              onFocus={() => setSelectedCueId(cue.id)}
                              onChange={(e) =>
                                updateCueText(cue.id, e.target.value)
                              }
                              className="w-full resize-none rounded-lg border border-ink/12 bg-page px-3 py-1.5 text-xs leading-relaxed text-ink transition placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                            />
                          </div>

                          {/* Click-to-Seek + Individual Timed Word Editor (revealed via Edit words) */}
                          {hasWordSync && isWordsExpanded && (
                            <div
                              data-testid={`cue-${idx + 1}-word-chips`}
                              aria-label={`Cue ${idx + 1} word timing`}
                              className="mt-2 flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-page/75 p-2 pl-2"
                            >
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
                                      className="inline-flex items-center gap-1 rounded-md border border-accent bg-page px-1 py-0.5"
                                    >
                                      <input
                                        type="text"
                                        autoFocus
                                        data-testid="inline-word-input"
                                        aria-label={`Edit word ${wIdx + 1} in cue ${idx + 1}`}
                                        value={editingWord.draft}
                                        onChange={(e) =>
                                          setEditingWord({
                                            ...editingWord,
                                            draft: e.target.value,
                                          })
                                        }
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
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          commitInlineWordEdit();
                                        }}
                                        className="inline-flex h-5 w-5 items-center justify-center rounded bg-accent text-page"
                                      >
                                        <Check className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label="Cancel word edit"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingWord(null);
                                        }}
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
                                    className="group/word inline-flex items-center"
                                  >
                                    <button
                                      type="button"
                                      data-testid={`cue-${idx + 1}-word-${wIdx + 1}`}
                                      data-active-word={
                                        isWordActive ? "true" : "false"
                                      }
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCueId(cue.id);
                                        seekToMs(word.start_ms);
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCueId(cue.id);
                                        setEditingWord({
                                          cueId: cue.id,
                                          wordId: word.id,
                                          draft: word.text,
                                        });
                                      }}
                                      title={`Seek to ${formatMsClock(word.start_ms)} (double-click to edit word)`}
                                      className={`rounded-md px-1.5 py-0.5 text-xs leading-snug transition ${
                                        isWordActive
                                          ? "bg-accent font-semibold text-page shadow-[0_0_12px_rgba(167,139,250,0.4)]"
                                          : isWordPast
                                            ? "bg-track/70 text-ink hover:bg-track"
                                            : isActive
                                              ? "bg-page/60 text-ink-secondary hover:text-ink"
                                              : "text-ink-secondary/85 hover:bg-elevated hover:text-ink"
                                      }`}
                                    >
                                      {word.text}
                                    </button>
                                    {isWordActive && (
                                      <button
                                        type="button"
                                        data-testid={`edit-active-word-btn-${idx + 1}`}
                                        aria-label={`Edit timed word ${word.text}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingWord({
                                            cueId: cue.id,
                                            wordId: word.id,
                                            draft: word.text,
                                          });
                                        }}
                                        className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded bg-accent-soft text-accent-hover hover:bg-accent hover:text-page"
                                      >
                                        <Pencil className="h-2.5 w-2.5" />
                                      </button>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Numeric Start / End Timing Controls */}
                          <div className="mt-2 grid grid-cols-2 gap-2 pl-1">
                            <label className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-page/85 px-2.5 py-1 text-[11px] text-ink-muted focus-within:border-accent">
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
                                onFocus={() => setSelectedCueId(cue.id)}
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

                            <label className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-page/85 px-2.5 py-1 text-[11px] text-ink-muted focus-within:border-accent">
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
                                onFocus={() => setSelectedCueId(cue.id)}
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Style & Saved Presets Panel */}
            <section
              id="editor-panel-style"
              role="tabpanel"
              aria-labelledby="editor-tab-style"
              data-testid="panel-style"
              className={`studio-scroll min-w-0 flex-col lg:max-h-[540px] lg:overflow-y-auto lg:pr-1 ${
                inspectorTab === "style" ? "flex" : "hidden"
              }`}
            >
              <StudioStylePanel
                style={style}
                onUpdateStyle={updateStyle}
                subtitle="Autosaves"
                showSafeArea={showSafeArea}
                onToggleSafeArea={setShowSafeArea}
                enablePersonalPresets
                personalPresets={personalPresets}
                onPersonalPresetsChange={setPersonalPresets}
              />
            </section>
          </aside>
        </div>

        {/* Full-Width Interactive Timeline Bar Below */}
        <section
          aria-label="Full-width caption timeline"
          className="mt-2.5 w-full"
        >
          <EditorTimeline
            cues={cues}
            style={style}
            durationMs={clipDurationMs}
            currentTimeMs={currentTimeMs}
            activeCueId={activeCue?.id ?? null}
            selectedCueId={selectedCueId}
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
        </section>
      </main>

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
    </div>
  );
}
