import { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/auth";
import { getSocket, disconnectSocket } from "../../api/socket";

interface AgentEvent {
  roomId: string;
  type: string;
  text?: string;
  tool?: string;
  input?: unknown;
  result?: unknown;
  error?: string;
  timestamp: string;
}

interface RoomActivity {
  roomId: string;
  events: AgentEvent[];
  thinkingBuffer: string;
  status: "idle" | "thinking" | "done";
}

export default function OperatorMonitor() {
  const { user, logout } = useAuthStore();
  const [activities, setActivities] = useState<Map<string, RoomActivity>>(new Map());
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const socket = getSocket();

  useEffect(() => {
    const addEvent = (roomId: string, event: Omit<AgentEvent, "roomId" | "timestamp">) => {
      setActivities((prev) => {
        const next = new Map(prev);
        const current = next.get(roomId) ?? { roomId, events: [], thinkingBuffer: "", status: "idle" };
        next.set(roomId, {
          ...current,
          events: [...current.events.slice(-50), { roomId, timestamp: new Date().toISOString(), ...event }],
        });
        return next;
      });
    };

    const onThinking = ({ roomId, status }: { roomId: string; status: string }) => {
      if (status === "thinking") {
        setActivities((prev) => {
          const next = new Map(prev);
          const current = next.get(roomId) ?? { roomId, events: [], thinkingBuffer: "", status: "idle" };
          next.set(roomId, { ...current, thinkingBuffer: "", status: "thinking" });
          return next;
        });
      }
    };

    const onThinkingStream = ({ roomId, text }: { roomId: string; text: string }) => {
      setActivities((prev) => {
        const next = new Map(prev);
        const current = next.get(roomId) ?? { roomId, events: [], thinkingBuffer: "", status: "idle" };
        next.set(roomId, { ...current, thinkingBuffer: current.thinkingBuffer + text });
        return next;
      });
    };

    const onToolCall = ({ roomId, tool, input }: { roomId: string; tool: string; input: unknown }) => {
      addEvent(roomId, { type: "tool_call", tool, input });
    };

    const onToolResult = ({ roomId, tool, result }: { roomId: string; tool: string; result: unknown }) => {
      addEvent(roomId, { type: "tool_result", tool, result });
    };

    const onDone = ({ roomId }: { roomId: string }) => {
      setActivities((prev) => {
        const next = new Map(prev);
        const current = next.get(roomId);
        if (current) {
          next.set(roomId, { ...current, status: "done" });
        }
        return next;
      });
    };

    const onError = ({ roomId, error }: { roomId: string; error: string }) => {
      addEvent(roomId, { type: "error", error });
    };

    socket.on("agent:thinking", onThinking);
    socket.on("agent:thinking_stream", onThinkingStream);
    socket.on("agent:tool_call", onToolCall);
    socket.on("agent:tool_result", onToolResult);
    socket.on("agent:done", onDone);
    socket.on("agent:error", onError);

    return () => {
      socket.off("agent:thinking", onThinking);
      socket.off("agent:thinking_stream", onThinkingStream);
      socket.off("agent:tool_call", onToolCall);
      socket.off("agent:tool_result", onToolResult);
      socket.off("agent:done", onDone);
      socket.off("agent:error", onError);
      disconnectSocket();
    };
  }, []);

  const activityList = Array.from(activities.values());
  const selected = selectedRoom ? activities.get(selectedRoom) : null;

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Left panel: active rooms */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700 bg-purple-900">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <div>
              <h1 className="font-bold text-sm">エージェント監視</h1>
              <p className="text-purple-300 text-xs">{user?.name}</p>
            </div>
          </div>
        </div>

        <div className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          アクティブルーム ({activityList.length})
        </div>

        <div className="flex-1 overflow-y-auto">
          {activityList.length === 0 ? (
            <p className="text-xs text-gray-500 p-4 text-center">
              エージェントのアクティビティを待機中...
            </p>
          ) : (
            activityList.map((activity) => (
              <button
                key={activity.roomId}
                onClick={() => setSelectedRoom(activity.roomId)}
                className={`w-full text-left px-4 py-3 border-b border-gray-700 hover:bg-gray-700 transition-colors ${
                  selectedRoom === activity.roomId ? "bg-gray-700 border-l-2 border-l-purple-400" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-mono">{activity.roomId.slice(0, 12)}...</p>
                  <StatusDot status={activity.status} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {activity.events.length} イベント
                </p>
              </button>
            ))
          )}
        </div>

        <div className="p-3 border-t border-gray-700">
          <button onClick={logout} className="text-xs text-gray-500 hover:text-gray-300">
            ログアウト
          </button>
        </div>
      </div>

      {/* Right panel: detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center gap-3">
              <StatusDot status={selected.status} />
              <h2 className="font-semibold font-mono">{selected.roomId}</h2>
              <span className="text-xs text-gray-400">
                {selected.status === "thinking" ? "⚡ 思考中..." : selected.status === "done" ? "✅ 完了" : "待機中"}
              </span>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Thinking stream */}
              <div className="w-1/2 border-r border-gray-700 flex flex-col">
                <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
                  <span className="text-xs font-semibold text-purple-400">🧠 思考プロセス（Adaptive Thinking）</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {selected.thinkingBuffer ? (
                    <p className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {selected.thinkingBuffer}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600 italic">思考プロセスがここに表示されます</p>
                  )}
                </div>
              </div>

              {/* Events */}
              <div className="w-1/2 flex flex-col">
                <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
                  <span className="text-xs font-semibold text-green-400">🔧 ツール呼び出しログ</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {selected.events.map((ev, i) => (
                    <EventCard key={i} event={ev} />
                  ))}
                  {selected.events.length === 0 && (
                    <p className="text-xs text-gray-600 italic">ツール呼び出しがここに表示されます</p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-600">
              <div className="text-5xl mb-3">🔍</div>
              <p className="text-lg font-medium text-gray-400">ルームを選択して監視</p>
              <p className="text-sm mt-1">左のパネルからルームを選択してください</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors = {
    thinking: "bg-yellow-400 animate-pulse",
    done: "bg-green-400",
    idle: "bg-gray-500",
  };
  return (
    <div className={`w-2.5 h-2.5 rounded-full ${colors[status as keyof typeof colors] ?? "bg-gray-500"}`} />
  );
}

function EventCard({ event }: { event: AgentEvent }) {
  const [expanded, setExpanded] = useState(false);

  const colors = {
    tool_call: "border-blue-500 bg-blue-950",
    tool_result: "border-green-500 bg-green-950",
    error: "border-red-500 bg-red-950",
  };

  const icons = { tool_call: "🔧", tool_result: "✅", error: "❌" };

  return (
    <div
      className={`border rounded-lg p-3 cursor-pointer ${
        colors[event.type as keyof typeof colors] ?? "border-gray-600 bg-gray-800"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{icons[event.type as keyof typeof icons] ?? "ℹ️"}</span>
          <span className="text-xs font-mono font-semibold">{event.tool ?? event.type}</span>
        </div>
        <span className="text-xs text-gray-500">
          {new Date(event.timestamp).toLocaleTimeString("ja-JP")}
        </span>
      </div>
      {expanded && (
        <div className="mt-2 text-xs font-mono text-gray-300 bg-black/30 rounded p-2 overflow-x-auto">
          <pre>{JSON.stringify(event.input ?? event.result ?? event.error, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
