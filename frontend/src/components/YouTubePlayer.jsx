import React, { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";

let ytApiPromise = null;

function loadYouTubeIframeAPI() {
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === "function") prevCallback();
        resolve(window.YT);
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
    });
  }
  return ytApiPromise;
}

export default function YouTubePlayer({
  videoId,
  playState,
  currentTime,
  syncVersion,
  canControl,
  onUserPlay,
  onUserPause,
  onTimeUpdate,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const isReadyRef = useRef(false);
  const isSyncingRef = useRef(false);
  const loadedVideoRef = useRef(videoId);
  const canControlRef = useRef(canControl);
  const [playerReady, setPlayerReady] = useState(false);

  canControlRef.current = canControl;

  // Initialize YouTube IFrame Player once
  useEffect(() => {
    let mounted = true;
    let pollInterval = null;

    loadYouTubeIframeAPI().then((YT) => {
      if (!mounted || !containerRef.current) return;

      const player = new YT.Player(containerRef.current, {
        videoId: loadedVideoRef.current,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (!mounted) return;
            isReadyRef.current = true;
            setPlayerReady(true);

            // Sync initial state on ready
            isSyncingRef.current = true;
            try {
              if (currentTime > 0) {
                player.seekTo(currentTime, true);
              }
              if (playState === "playing") {
                player.playVideo();
              } else {
                player.pauseVideo();
              }
            } finally {
              setTimeout(() => {
                isSyncingRef.current = false;
              }, 400);
            }
          },
          onStateChange: (event) => {
            if (isSyncingRef.current || !canControlRef.current) return;
            const YTState = window.YT?.PlayerState;
            if (!YTState) return;

            const time = typeof player.getCurrentTime === "function" ? player.getCurrentTime() : 0;
            if (event.data === YTState.PLAYING) {
              onUserPlay(time);
            } else if (event.data === YTState.PAUSED) {
              onUserPause(time);
            }
          },
        },
      });

      playerRef.current = player;

      pollInterval = setInterval(() => {
        if (!isReadyRef.current || !playerRef.current) return;
        const t =
          typeof playerRef.current.getCurrentTime === "function"
            ? playerRef.current.getCurrentTime()
            : 0;
        const d =
          typeof playerRef.current.getDuration === "function"
            ? playerRef.current.getDuration()
            : 0;
        onTimeUpdate({ currentTime: t || 0, duration: d || 0 });
      }, 500);
    });

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      isReadyRef.current = false;
    };
  }, []);

  // Apply incoming server sync_state updates
  useEffect(() => {
    const player = playerRef.current;
    if (!isReadyRef.current || !player) return;

    isSyncingRef.current = true;

    try {
      if (videoId && loadedVideoRef.current !== videoId) {
        loadedVideoRef.current = videoId;
        if (playState === "playing") {
          player.loadVideoById({ videoId, startSeconds: currentTime || 0 });
        } else {
          player.cueVideoById({ videoId, startSeconds: currentTime || 0 });
        }
      } else {
        const localTime =
          typeof player.getCurrentTime === "function" ? player.getCurrentTime() : 0;
        const drift = Math.abs(localTime - (currentTime || 0));

        if (drift > 1.25) {
          player.seekTo(currentTime || 0, true);
        }

        const YTState = window.YT?.PlayerState;
        const localState =
          typeof player.getPlayerState === "function" ? player.getPlayerState() : -1;

        if (playState === "playing" && localState !== YTState?.PLAYING) {
          player.playVideo();
        } else if (playState === "paused" && localState === YTState?.PLAYING) {
          player.pauseVideo();
        }
      }
    } finally {
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 450);
    }
  }, [videoId, playState, currentTime, syncVersion, playerReady]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-2xl aspect-video">
      <div ref={containerRef} className="h-full w-full" />

      {/* Prevent Participants/Viewers from directly clicking the player to desync */}
      {!canControl && (
        <div
          className="absolute inset-0 z-10 flex items-end justify-end p-3 bg-transparent"
          title="Playback is controlled by the Host and Moderators"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cinema-950/85 px-3 py-1 text-xs font-medium text-slate-300 border border-slate-700/80 backdrop-blur">
            <Lock className="h-3.5 w-3.5 text-amber-400" />
            Watch-only mode — use Request Controls below
          </span>
        </div>
      )}
    </div>
  );
}
