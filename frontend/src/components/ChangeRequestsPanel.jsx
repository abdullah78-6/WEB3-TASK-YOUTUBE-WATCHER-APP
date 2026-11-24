import React from "react";
import { Check, X, Bell } from "lucide-react";
import { formatTime } from "../utils/youtube";

function describeRequest(req) {
  if (req.action === "play") return "Play video";
  if (req.action === "pause") return "Pause video";
  if (req.action === "seek") return `Seek to ${formatTime(req.payload?.time)}`;
  if (req.action === "change_video") return `Change video to ID: ${req.payload?.videoId}`;
  return req.action;
}

export default function ChangeRequestsPanel({ requests, onResolve }) {
  if (!requests || requests.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-cinema-950/60 p-3 text-xs text-slate-400">
        No pending participant change requests.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
        <Bell className="h-3.5 w-3.5" />
        Pending Approval Requests ({requests.length})
      </div>
      <ul className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {requests.map((req) => (
          <li
            key={req.requestId}
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2"
          >
            <div className="text-xs text-slate-200">
              <span className="font-semibold text-white">{req.username}</span> requested:{" "}
              <span className="text-amber-200 font-medium">{describeRequest(req)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onResolve(req.requestId, true)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 transition"
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => onResolve(req.requestId, false)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-cinema-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-cinema-700 transition"
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
