import React, { useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Link2,
  Send,
  ShieldCheck,
  Hand,
} from "lucide-react";
import { extractYouTubeVideoId, formatTime } from "../utils/youtube";

export default function PlaybackControls({
  canControl,
  playState,
  localTime,
  duration,
  onPlay,
  onPause,
  onSeek,
  onChangeVideo,
  onRequestChange,
}) {
  const [videoInput, setVideoInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const displayedTime = isDragging ? dragValue : localTime;
  const maxDuration = duration > 0 ? duration : Math.max(displayedTime, 100);

  const handleTogglePlay = () => {
    if (canControl) {
      if (playState === "playing") onPause(localTime);
      else onPlay(localTime);
    } else {
      onRequestChange(playState === "playing" ? "pause" : "play", {});
    }
  };

  const handleSkip = (delta) => {
    const target = Math.max(0, Math.min(maxDuration, Math.floor(localTime + delta)));
    if (canControl) {
      onSeek(target);
    } else {
      onRequestChange("seek", { time: target });
    }
  };

  const handleSeekCommit = (value) => {
    setIsDragging(false);
    const target = Math.max(0, Math.floor(Number(value) || 0));
    if (canControl) {
      onSeek(target);
    } else {
      onRequestChange("seek", { time: target });
    }
  };

  const handleVideoSubmit = (e) => {
    e.preventDefault();
    setInputError("");
    const parsedId = extractYouTubeVideoId(videoInput);
    if (!parsedId) {
      setInputError("Enter a valid YouTube URL or 11-character video ID.");
      return;
    }

    if (canControl) {
      onChangeVideo(parsedId);
    } else {
      onRequestChange("change_video", { videoId: parsedId });
    }
    setVideoInput("");
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-cinema-900 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          {canControl ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="h-3.5 w-3.5" />
              Live Controls Enabled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-amber-300 border border-amber-500/30">
              <Hand className="h-3.5 w-3.5" />
              Request Mode (Requires Host/Moderator Approval)
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-slate-400">
          {formatTime(displayedTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Seek Bar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => handleSkip(-10)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-cinema-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-cinema-700 transition"
          title={canControl ? "Rewind 10s" : "Request rewind 10s"}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          10s
        </button>

        <button
          type="button"
          onClick={handleTogglePlay}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition shadow"
        >
          {playState === "playing" ? (
            <>
              <Pause className="h-4 w-4" />
              {canControl ? "Pause" : "Request Pause"}
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {canControl ? "Play" : "Request Play"}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSkip(10)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-cinema-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-cinema-700 transition"
          title={canControl ? "Forward 10s" : "Request forward 10s"}
        >
          10s
          <RotateCw className="h-3.5 w-3.5" />
        </button>

        <input
          type="range"
          min={0}
          max={Math.floor(maxDuration)}
          value={Math.floor(displayedTime)}
          onChange={(e) => {
            setIsDragging(true);
            setDragValue(Number(e.target.value));
          }}
          onMouseUp={(e) => handleSeekCommit(e.target.value)}
          onTouchEnd={(e) => handleSeekCommit(e.target.value)}
          aria-label="Video seek timeline"
          className="flex-1 accent-rose-500 cursor-pointer"
        />
      </div>

      {/* Change Video Form */}
      <form onSubmit={handleVideoSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={videoInput}
            onChange={(e) => {
              setVideoInput(e.target.value);
              if (inputError) setInputError("");
            }}
            placeholder="Paste YouTube URL or video ID (e.g. https://youtu.be/dQw4w9WgXcQ)"
            className="w-full rounded-xl border border-slate-700 bg-cinema-950 pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white transition"
        >
          <Send className="h-4 w-4" />
          {canControl ? "Change Video" : "Request Video"}
        </button>
      </form>
      {inputError && <p className="text-xs text-rose-400">{inputError}</p>}
    </div>
  );
}
