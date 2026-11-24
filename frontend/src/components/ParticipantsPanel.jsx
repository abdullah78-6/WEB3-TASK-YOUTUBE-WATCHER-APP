import React from "react";
import { Crown, Shield, User, UserX, ArrowRightLeft } from "lucide-react";

const ROLE_STYLES = {
  Host: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  Moderator: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  Participant: "bg-slate-700/60 text-slate-300 border-slate-600",
  Viewer: "bg-slate-800 text-slate-400 border-slate-700",
};

function RoleIcon({ role }) {
  if (role === "Host") return <Crown className="h-3.5 w-3.5 text-amber-400" />;
  if (role === "Moderator") return <Shield className="h-3.5 w-3.5 text-sky-400" />;
  return <User className="h-3.5 w-3.5 text-slate-400" />;
}

export default function ParticipantsPanel({
  participants,
  self,
  onAssignRole,
  onRemoveParticipant,
  onTransferHost,
}) {
  const isHost = self?.role === "Host";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          Participants ({participants.length})
        </h3>
        {isHost && (
          <span className="text-[11px] text-slate-400">Host can manage roles</span>
        )}
      </div>

      <ul className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {participants.map((p) => {
          const isSelf = p.userId === self?.userId;
          return (
            <li
              key={p.userId}
              className="rounded-xl border border-slate-800 bg-cinema-950/80 p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <RoleIcon role={p.role} />
                  <span className="truncate text-sm font-medium text-slate-100">
                    {p.username}
                    {isSelf && <span className="ml-1.5 text-xs text-slate-400">(You)</span>}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    ROLE_STYLES[p.role] || ROLE_STYLES.Participant
                  }`}
                >
                  {p.role}
                </span>
              </div>

              {isHost && !isSelf && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
                  <select
                    value={p.role}
                    onChange={(e) => onAssignRole(p.userId, e.target.value)}
                    aria-label={`Assign role for ${p.username}`}
                    className="rounded-lg border border-slate-700 bg-cinema-800 px-2 py-1 text-xs text-slate-200 focus:border-rose-500 focus:outline-none"
                  >
                    <option value="Moderator">Moderator</option>
                    <option value="Participant">Participant</option>
                    <option value="Viewer">Viewer</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => onTransferHost(p.userId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/20 transition"
                    title="Transfer Host role"
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                    Make Host
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemoveParticipant(p.userId)}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/20 transition"
                    title="Remove from room"
                  >
                    <UserX className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
