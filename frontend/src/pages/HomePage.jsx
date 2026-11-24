import React, { useEffect, useState } from "react";
import { Tv, PlusCircle, LogIn, Users, PlayCircle } from "lucide-react";

export default function HomePage({ backendUrl, initialRoomCode, onEnterRoom }) {
  const [mode, setMode] = useState(initialRoomCode ? "join" : "create");
  const [username, setUsername] = useState("");
  const [roomName, setRoomName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [roomCode, setRoomCode] = useState(initialRoomCode || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeRooms, setActiveRooms] = useState([]);

  useEffect(() => {
    if (initialRoomCode) {
      setMode("join");
      setRoomCode(initialRoomCode.toUpperCase());
    }
  }, [initialRoomCode]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${backendUrl}/api/rooms`)
      .then((res) => (res.ok ? res.json() : { rooms: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data.rooms)) {
          setActiveRooms(data.rooms);
        }
      })
      .catch(() => {
        // Backend may not be running yet; keep list empty gracefully
      });
    return () => {
      cancelled = true;
    };
  }, [backendUrl]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError("");
    const cleanUser = username.trim();
    if (cleanUser.length < 2) {
      setError("Please enter a username (at least 2 characters).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUser,
          name: roomName.trim() || undefined,
          videoUrl: videoUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not create room.");
      }

      onEnterRoom({
        roomId: data.roomId,
        username: cleanUser,
        hostToken: data.hostToken,
      });
    } catch (err) {
      setError(err.message || "Failed to connect to backend server.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setError("");
    const cleanUser = username.trim();
    const cleanCode = roomCode.trim().toUpperCase();

    if (cleanUser.length < 2) {
      setError("Please enter a username (at least 2 characters).");
      return;
    }
    if (!cleanCode) {
      setError("Please enter a room code.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/rooms/${encodeURIComponent(cleanCode)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Room not found.");
      }

      onEnterRoom({
        roomId: data.roomId,
        username: cleanUser,
        hostToken: "",
      });
    } catch (err) {
      setError(err.message || "Failed to connect to backend server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cinema-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800/80 bg-cinema-900/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow">
              <Tv className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">SyncTube</h1>
              <p className="text-xs text-slate-400">Real-Time YouTube Watch Party</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-full border border-slate-700 bg-cinema-800 px-3 py-1 text-xs text-slate-300">
            WebSockets + Role-Based Sync
          </span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-10 grid gap-8 lg:grid-cols-5 items-start">
        {/* Hero Info */}
        <section className="lg:col-span-2 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300">
            <PlayCircle className="h-3.5 w-3.5" />
            Watch Together In Perfect Sync
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            One room. Every pause, seek, and video change in real time.
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Create a private room to become the <strong className="text-slate-200">Host</strong>,
            invite friends with a shareable link, promote trusted{" "}
            <strong className="text-slate-200">Moderators</strong>, and approve playback requests
            from <strong className="text-slate-200">Participants</strong>.
          </p>

          {activeRooms.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-cinema-900 p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Rooms Right Now
              </h3>
              <ul className="space-y-2">
                {activeRooms.map((r) => (
                  <li
                    key={r.roomId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-cinema-950 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-200">{r.name}</p>
                      <p className="text-slate-400">
                        Code: <span className="font-mono text-rose-300">{r.roomId}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("join");
                        setRoomCode(r.roomId);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-cinema-800 px-2.5 py-1.5 font-medium text-slate-200 hover:bg-cinema-700 transition"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {r.participantCount} · Select
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Create / Join Card */}
        <section className="lg:col-span-3 rounded-2xl border border-slate-800 bg-cinema-900 p-6 shadow-2xl">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-cinema-950 p-1 mb-6 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode("create");
                setError("");
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
                mode === "create"
                  ? "bg-rose-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <PlusCircle className="h-4 w-4" />
              Create Room
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("join");
                setError("");
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
                mode === "join"
                  ? "bg-rose-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LogIn className="h-4 w-4" />
              Join Room
            </button>
          </div>

          {mode === "create" ? (
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Your Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. Abdullah"
                  className="w-full rounded-xl border border-slate-700 bg-cinema-950 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Room Name (Optional)
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Friday Movie Night"
                  className="w-full rounded-xl border border-slate-700 bg-cinema-950 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Starting YouTube URL or Video ID (Optional)
                </label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=jfKfPfyJRdk"
                  className="w-full rounded-xl border border-slate-700 bg-cinema-950 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60 transition shadow-lg"
              >
                {loading ? "Creating Room..." : "Create Watch Party as Host"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Your Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. Sara"
                  className="w-full rounded-xl border border-slate-700 bg-cinema-950 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Room Code *
                </label>
                <input
                  type="text"
                  required
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AB12CD"
                  className="w-full rounded-xl border border-slate-700 bg-cinema-950 px-3.5 py-2.5 text-sm font-mono uppercase tracking-widest text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60 transition shadow-lg"
              >
                {loading ? "Joining Room..." : "Join Watch Party"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
