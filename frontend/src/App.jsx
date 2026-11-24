import React, { useCallback, useEffect, useState } from "react";
import HomePage from "./pages/HomePage";
import WatchRoomPage from "./pages/WatchRoomPage";
const BACKEND_URL ="https://web3-task-youtube-watcher-app-backend.onrender.com";
function getRoomCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("room") || "").trim().toUpperCase();
}

export default function App() {
  const [initialRoomCode, setInitialRoomCode] = useState(() => getRoomCodeFromUrl());
  const [session, setSession] = useState(null);

  useEffect(() => {
    const onPopState = () => {
      const code = getRoomCodeFromUrl();
      setInitialRoomCode(code);
      if (!code) setSession(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleEnterRoom = useCallback(({ roomId, username, hostToken }) => {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    window.history.pushState({}, "", url.toString());
    setSession({ roomId, username, hostToken });
  }, []);

  const handleLeaveRoom = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.pushState({}, "", url.toString());
    setInitialRoomCode("");
    setSession(null);
  }, []);

  if (session) {
    return (
      <WatchRoomPage
        backendUrl={BACKEND_URL}
        roomId={session.roomId}
        username={session.username}
        hostToken={session.hostToken}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <HomePage
      backendUrl={BACKEND_URL}
      initialRoomCode={initialRoomCode}
      onEnterRoom={handleEnterRoom}
    />
  );
}
