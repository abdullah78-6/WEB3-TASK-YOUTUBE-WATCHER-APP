import React, { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Copy,
  Check,
  LogOut,
  Users,
  MessageSquare,
  Tv,
  Wifi,
  WifiOff,
} from "lucide-react";
import YouTubePlayer from "../components/YouTubePlayer";
import PlaybackControls from "../components/PlaybackControls";
import ParticipantsPanel from "../components/ParticipantsPanel";
import ChangeRequestsPanel from "../components/ChangeRequestsPanel";
import ChatPanel from "../components/ChatPanel";

export default function WatchRoomPage({
  backendUrl,
  roomId,
  username,
  hostToken,
  onLeaveRoom,
}) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [roomName, setRoomName] = useState("Watch Party");
  const [self, setSelf] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [syncState, setSyncState] = useState({
    videoId: "jfKfPfyJRdk",
    playState: "paused",
    currentTime: 0,
  });
  const [syncVersion, setSyncVersion] = useState(0);
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTab, setActiveTab] = useState("participants");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState(null);

  const canControl = self?.role === "Host" || self?.role === "Moderator";

  const showNotice = useCallback((text, tone = "info") => {
    setNotice({ text, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const socket = io(backendUrl, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_room", { roomId, username, hostToken });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("room_joined", (data) => {
      setRoomName(data.name || "Watch Party");
      setSelf(data.self);
      setParticipants(data.participants || []);
      setMessages(data.messages || []);
      setPendingRequests(data.pendingRequests || []);
      if (data.syncState) {
        setSyncState(data.syncState);
        setSyncVersion((v) => v + 1);
      }
    });

    socket.on("sync_state", (nextState) => {
      setSyncState(nextState);
      setSyncVersion((v) => v + 1);
    });

    socket.on("user_joined", (data) => {
      setParticipants(data.participants || []);
      showNotice(`${data.username} joined as ${data.role}.`, "info");
    });

    socket.on("user_left", (data) => {
      setParticipants(data.participants || []);
      showNotice(`${data.username} left the room.`, "info");
    });

    socket.on("role_assigned", (data) => {
      setParticipants(data.participants || []);
      setSelf((prev) =>
        prev && prev.userId === data.userId ? { ...prev, role: data.role } : prev
      );
      showNotice(`${data.username} is now ${data.role}.`, "success");
    });

    socket.on("host_transferred", (data) => {
      setParticipants(data.participants || []);
      setSelf((prev) => {
        if (!prev) return prev;
        const updated = (data.participants || []).find((p) => p.userId === prev.userId);
        return updated ? { ...prev, role: updated.role } : prev;
      });
      showNotice(`Host role transferred to ${data.newHostUsername}.`, "success");
    });

    socket.on("participant_removed", (data) => {
      setParticipants(data.participants || []);
      showNotice(`${data.username || "A participant"} was removed by the Host.`, "warning");
    });

    socket.on("removed_from_room", (data) => {
      alert(data.reason || "You were removed from the room by the Host.");
      onLeaveRoom();
    });

    socket.on("change_request_submitted", () => {
      showNotice("Change request sent to Host/Moderators for approval.", "info");
    });

    socket.on("change_request_received", (data) => {
      setPendingRequests(data.requests || []);
      showNotice(
        `${data.request.username} requested "${data.request.action}".`,
        "warning"
      );
    });

    socket.on("pending_requests_updated", (data) => {
      setPendingRequests(data.requests || []);
    });

    socket.on("change_request_resolved", (data) => {
      showNotice(
        `${data.requestedBy}'s "${data.action}" request was ${
          data.approved ? "approved" : "rejected"
        } by ${data.resolvedBy}.`,
        data.approved ? "success" : "warning"
      );
    });

    socket.on("new_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("error_message", (data) => {
      showNotice(data.message || "Action rejected by server.", "error");
    });

    return () => {
      socket.emit("leave_room", { roomId });
      socket.disconnect();
    };
  }, [backendUrl, roomId, username, hostToken, onLeaveRoom, showNotice]);

  const handleCopyInvite = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showNotice(`Share this room code: ${roomId}`, "info");
    }
  };

  const handleLeave = () => {
    socketRef.current?.emit("leave_room", { roomId });
    onLeaveRoom();
  };

  const emitPlay = useCallback((time) => {
    socketRef.current?.emit("play", { time });
  }, []);

  const emitPause = useCallback((time) => {
    socketRef.current?.emit("pause", { time });
  }, []);

  const emitSeek = useCallback((time) => {
    socketRef.current?.emit("seek", { time });
  }, []);

  const emitChangeVideo = useCallback((videoId) => {
    socketRef.current?.emit("change_video", { videoId });
  }, []);

  const emitRequestChange = useCallback((action, payload) => {
    socketRef.current?.emit("request_change", { action, payload });
  }, []);

  const emitResolveRequest = useCallback((requestId, approved) => {
    socketRef.current?.emit("resolve_change_request", { requestId, approved });
  }, []);

  const emitAssignRole = useCallback((userId, role) => {
    socketRef.current?.emit("assign_role", { userId, role });
  }, []);

  const emitRemoveParticipant = useCallback((userId) => {
    socketRef.current?.emit("remove_participant", { userId });
  }, []);

  const emitTransferHost = useCallback((userId) => {
    socketRef.current?.emit("transfer_host", { userId });
  }, []);

  const emitSendMessage = useCallback((text) => {
    socketRef.current?.emit("send_message", { text });
  }, []);

  const handleTimeUpdate = useCallback(({ currentTime: t, duration: d }) => {
    setLocalTime(t);
    if (d > 0) setDuration(d);
  }, []);

  return (
    <div className="min-h-screen bg-cinema-950 text-slate-100 flex flex-col">
      {/* Top Room Header */}
      <header className="border-b border-slate-800 bg-cinema-900/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
              <Tv className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-white">{roomName}</h1>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>
                  Room: <strong className="font-mono text-rose-300">{roomId}</strong>
                </span>
                <span>·</span>
                <span>
                  You: <strong className="text-slate-200">{self?.username || username}</strong> (
                  {self?.role || "..."})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                connected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}
            >
              {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {connected ? "Live" : "Reconnecting"}
            </span>

            <button
              type="button"
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-cinema-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-cinema-700 transition"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Link Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Invite Link
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleLeave}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave
            </button>
          </div>
        </div>
      </header>

      {/* Notification Banner */}
      {notice && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-3">
          <div
            className={`rounded-xl border px-4 py-2 text-xs font-medium ${
              notice.tone === "error"
                ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
                : notice.tone === "success"
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                : notice.tone === "warning"
                ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                : "border-sky-500/40 bg-sky-500/15 text-sky-200"
            }`}
          >
            {notice.text}
          </div>
        </div>
      )}

      {/* Main Layout */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 grid gap-5 lg:grid-cols-12 items-start">
        {/* Left: Video + Controls */}
        <section className="lg:col-span-8 space-y-4">
          <YouTubePlayer
            videoId={syncState.videoId}
            playState={syncState.playState}
            currentTime={syncState.currentTime}
            syncVersion={syncVersion}
            canControl={canControl}
            onUserPlay={emitPlay}
            onUserPause={emitPause}
            onTimeUpdate={handleTimeUpdate}
          />

          <PlaybackControls
            canControl={canControl}
            playState={syncState.playState}
            localTime={localTime}
            duration={duration}
            onPlay={emitPlay}
            onPause={emitPause}
            onSeek={emitSeek}
            onChangeVideo={emitChangeVideo}
            onRequestChange={emitRequestChange}
          />
        </section>

        {/* Right: Approval Requests + Participants / Chat */}
        <aside className="lg:col-span-4 space-y-4">
          {canControl && (
            <div className="rounded-2xl border border-slate-800 bg-cinema-900 p-4">
              <ChangeRequestsPanel
                requests={pendingRequests}
                onResolve={emitResolveRequest}
              />
            </div>
          )}

          <div className="rounded-2xl border border-slate-800 bg-cinema-900 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-cinema-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("participants")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                  activeTab === "participants"
                    ? "bg-cinema-800 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                People ({participants.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                  activeTab === "chat"
                    ? "bg-cinema-800 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat ({messages.length})
              </button>
            </div>

            {activeTab === "participants" ? (
              <ParticipantsPanel
                participants={participants}
                self={self}
                onAssignRole={emitAssignRole}
                onRemoveParticipant={emitRemoveParticipant}
                onTransferHost={emitTransferHost}
              />
            ) : (
              <ChatPanel messages={messages} onSendMessage={emitSendMessage} />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
