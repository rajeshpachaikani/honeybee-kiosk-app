import { useState, useCallback, useEffect, useRef } from "react";
import {
  Mic,
  X,
  Square,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface RecorderAppProps {
  onClose: () => void;
}

interface RecordingStatus {
  recording: boolean;
  duration_ms: number;
}

interface RecordingSaved {
  path: string;
  filename: string;
  duration_ms: number;
  success: boolean;
  error: string | null;
}

export function RecorderApp({ onClose }: RecorderAppProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const unlistenStatusRef = useRef<UnlistenFn | null>(null);
  const unlistenSavedRef = useRef<UnlistenFn | null>(null);
  const unlistenErrorRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    const setup = async () => {
      unlistenStatusRef.current = await listen<RecordingStatus>(
        "recording-status",
        (event) => {
          setDurationMs(event.payload.duration_ms);
        }
      );

      unlistenSavedRef.current = await listen<RecordingSaved>(
        "recording-saved",
        (event) => {
          setSaving(false);
          if (event.payload.success) {
            setLastSaved(event.payload.filename);
            setShowSaved(true);
            setTimeout(() => setShowSaved(false), 3000);
          } else {
            setError(event.payload.error || "Failed to save recording");
          }
        }
      );

      unlistenErrorRef.current = await listen<string>(
        "recording-error",
        (event) => {
          setError(event.payload);
          setIsRecording(false);
        }
      );

      // Check if already recording
      const recording = await invoke<boolean>("is_recording");
      setIsRecording(recording);
    };

    setup();

    return () => {
      if (unlistenStatusRef.current) unlistenStatusRef.current();
      if (unlistenSavedRef.current) unlistenSavedRef.current();
      if (unlistenErrorRef.current) unlistenErrorRef.current();
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setDurationMs(0);
    try {
      await invoke("start_recording");
      setIsRecording(true);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    setSaving(true);
    try {
      await invoke("stop_recording");
      setIsRecording(false);
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  }, []);

  const handleClose = useCallback(async () => {
    if (isRecording) {
      await invoke("stop_recording").catch(() => {});
    }
    onClose();
  }, [isRecording, onClose]);

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `${min.toString().padStart(2, "0")}:${sec
      .toString()
      .padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Mic className="h-6 w-6 text-amber-500" />
          <h1 className="text-lg font-semibold text-white">Recorder</h1>
        </div>
        <button
          onClick={handleClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 transition-all hover:bg-zinc-700 hover:text-white active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
        {/* Visualizer ring */}
        <div
          className={cn(
            "relative flex h-48 w-48 items-center justify-center rounded-full border-4 transition-all duration-300",
            isRecording
              ? "border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.3)]"
              : "border-zinc-700"
          )}
        >
          {isRecording && (
            <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping" />
          )}
          <Mic
            className={cn(
              "h-16 w-16 transition-colors",
              isRecording ? "text-red-400" : "text-zinc-500"
            )}
          />
        </div>

        {/* Timer */}
        <div className="text-center">
          <p
            className={cn(
              "font-mono text-4xl font-light tracking-wider",
              isRecording ? "text-white" : "text-zinc-600"
            )}
          >
            {formatDuration(durationMs)}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {isRecording
              ? "Recording..."
              : saving
              ? "Saving..."
              : "Tap to record"}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Save notification */}
        {showSaved && lastSaved && (
          <div className="flex items-center gap-2 bg-emerald-500/90 text-white px-4 py-2 rounded-full text-sm shadow-lg">
            Recording saved!
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-6 py-8 flex items-center justify-center">
        {isRecording ? (
          <button
            onClick={stopRecording}
            disabled={saving}
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-full",
              "bg-red-500 transition-all",
              "hover:bg-red-600 active:scale-95",
              "ring-4 ring-red-500/30 ring-offset-4 ring-offset-black",
              "disabled:opacity-50"
            )}
          >
            {saving ? (
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            ) : (
              <Square className="h-8 w-8 text-white fill-white" />
            )}
          </button>
        ) : (
          <button
            onClick={startRecording}
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-full",
              "bg-red-500 transition-all",
              "hover:bg-red-600 hover:scale-105 active:scale-95",
              "ring-4 ring-red-500/30 ring-offset-4 ring-offset-black"
            )}
          >
            <Mic className="h-8 w-8 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}

export default RecorderApp;
