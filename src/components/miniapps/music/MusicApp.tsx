import { useState, useCallback, useEffect, useRef } from "react";
import {
  Music,
  X,
  Play,
  Pause,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MusicAppProps {
  onClose: () => void;
}

interface RecordingInfo {
  filename: string;
  path: string;
  size: number;
  modified: number;
}

export function MusicApp({ onClose }: MusicAppProps) {
  const [recordings, setRecordings] = useState<RecordingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<RecordingInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load recordings
  const loadRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<RecordingInfo[]>("list_recordings");
      setRecordings(result);
    } catch (err) {
      console.error("Failed to list recordings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecordings();
    return () => {
      // Cleanup audio on unmount
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [loadRecordings]);

  // Play a track
  const playTrack = useCallback(
    async (recording: RecordingInfo) => {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }

      try {
        const dataUrl = await invoke<string>("read_audio_file", {
          path: recording.path,
        });

        const audio = new Audio(dataUrl);
        audioRef.current = audio;
        setCurrentTrack(recording);
        setProgress(0);

        audio.addEventListener("loadedmetadata", () => {
          setDuration(audio.duration);
        });

        audio.addEventListener("ended", () => {
          setIsPlaying(false);
          setProgress(0);
          if (progressInterval.current) {
            clearInterval(progressInterval.current);
          }
        });

        await audio.play();
        setIsPlaying(true);

        progressInterval.current = setInterval(() => {
          if (audioRef.current) {
            setProgress(audioRef.current.currentTime);
          }
        }, 100);
      } catch (err) {
        console.error("Failed to play:", err);
      }
    },
    []
  );

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Seek
  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setProgress(time);
      }
    },
    []
  );

  // Delete recording
  const deleteRecording = useCallback(
    async (path: string) => {
      setDeleting(true);
      try {
        await invoke("delete_recording", { path });
        // Stop if currently playing this track
        if (currentTrack?.path === path) {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          setCurrentTrack(null);
          setIsPlaying(false);
        }
        setRecordings((prev) => prev.filter((r) => r.path !== path));
      } catch (err) {
        console.error("Failed to delete:", err);
      } finally {
        setDeleting(false);
        setConfirmDelete(null);
      }
    },
    [currentTrack]
  );

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "";
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Music className="h-6 w-6 text-emerald-400" />
          <h1 className="text-lg font-semibold text-white">Music</h1>
          {recordings.length > 0 && (
            <span className="text-sm text-zinc-500">
              ({recordings.length})
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 transition-all hover:bg-zinc-700 hover:text-white active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center pt-20">
            <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <AlertCircle className="h-16 w-16 text-zinc-600 mb-4" />
            <h2 className="text-lg font-medium text-zinc-400 mb-2">
              No recordings yet
            </h2>
            <p className="text-sm text-zinc-600">
              Use the Recorder app to create recordings
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recordings.map((rec) => (
              <div
                key={rec.path}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                  currentTrack?.path === rec.path
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : "bg-zinc-800/50 hover:bg-zinc-800"
                )}
              >
                {/* Play button */}
                <button
                  onClick={() =>
                    currentTrack?.path === rec.path
                      ? togglePlayPause()
                      : playTrack(rec)
                  }
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors",
                    currentTrack?.path === rec.path
                      ? "bg-emerald-500 text-white"
                      : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                  )}
                >
                  {currentTrack?.path === rec.path && isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </button>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {rec.filename.replace(/\.wav$/, "")}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(rec.modified)} · {formatSize(rec.size)}
                  </p>
                </div>

                {/* Delete */}
                {confirmDelete === rec.path ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(null)}
                      className="h-8 px-2 text-xs text-zinc-400"
                    >
                      No
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => deleteRecording(rec.path)}
                      disabled={deleting}
                      className="h-8 px-2 text-xs bg-red-600 hover:bg-red-700 text-white"
                    >
                      {deleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Yes"
                      )}
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(rec.path)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Now Playing bar */}
      {currentTrack && (
        <div className="border-t border-zinc-800 bg-zinc-900/80 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayPause}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">
                {currentTrack.filename.replace(/\.wav$/, "")}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-zinc-500 w-8 text-right">
                  {formatTime(progress)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={progress}
                  onChange={handleSeek}
                  className="flex-1 h-1 accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10px] text-zinc-500 w-8">
                  {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MusicApp;
