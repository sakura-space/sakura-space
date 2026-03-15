import { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/auth";
import { getSocket, disconnectSocket } from "../../api/socket";
import ChatWindow, { ChatMessage } from "../../components/ChatWindow";
import api from "../../api/client";

interface Room {
  id: string;
  name: string | null;
  updatedAt: string;
  members: { user: { id: string; name: string; role: string } }[];
  agentSessions: { status: string }[];
  messages: ChatMessage[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "対応中", color: "bg-green-100 text-green-700" },
  ESCALATED: { label: "エスカレーション", color: "bg-yellow-100 text-yellow-700" },
  RESOLVED: { label: "解決済", color: "bg-gray-100 text-gray-600" },
  CLOSED: { label: "クローズ", color: "bg-gray-100 text-gray-500" },
};

export default function OperatorChat() {
  const { user, logout } = useAuthStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomMessages, setRoomMessages] = useState<ChatMessage[]>([]);
  const [escalations, setEscalations] = useState<{ roomId: string; reason: string }[]>([]);
  const socket = getSocket();

  useEffect(() => {
    fetchRooms();

    socket.on("escalation:new", (data: { roomId: string; reason: string }) => {
      setEscalations((prev) => [...prev, data]);
      fetchRooms();
    });

    return () => {
      socket.off("escalation:new");
      disconnectSocket();
    };
  }, []);

  const fetchRooms = async () => {
    const { data } = await api.get("/rooms/all");
    setRooms(data);
  };

  const openRoom = async (room: Room) => {
    const { data } = await api.get(`/rooms/${room.id}`);
    setActiveRoom(data);
    setRoomMessages(data.messages ?? []);
  };

  const joinRoom = async (roomId: string) => {
    socket.emit("operator:join_room", { roomId });
    setEscalations((prev) => prev.filter((e) => e.roomId !== roomId));
    const room = rooms.find((r) => r.id === roomId);
    if (room) openRoom(room);
    fetchRooms();
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r flex flex-col">
        <div className="p-4 border-b bg-green-600">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👤</span>
            <div>
              <h1 className="text-white font-bold text-sm">オペレータ画面</h1>
              <p className="text-green-100 text-xs">{user?.name}</p>
            </div>
          </div>
        </div>

        {/* Escalation alerts */}
        {escalations.length > 0 && (
          <div className="p-3 bg-yellow-50 border-b border-yellow-200">
            <p className="text-xs font-bold text-yellow-700 mb-2">
              🔔 エスカレーション通知 ({escalations.length})
            </p>
            {escalations.map((e, i) => (
              <div key={i} className="bg-white border border-yellow-300 rounded-lg p-2 mb-2">
                <p className="text-xs text-gray-600 mb-1">{e.reason}</p>
                <button
                  onClick={() => joinRoom(e.roomId)}
                  className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                >
                  参加する
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            全チャットルーム
          </div>
          {rooms.map((room) => {
            const session = room.agentSessions?.[0];
            const status = STATUS_LABELS[session?.status ?? ""] ?? null;
            const users = room.members.filter((m) => m.user.role === "USER");
            return (
              <button
                key={room.id}
                onClick={() => openRoom(room)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b transition-colors ${
                  activeRoom?.id === room.id ? "bg-green-50 border-l-2 border-l-green-500" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm text-gray-800">
                    {room.name ?? "HR相談"}
                  </p>
                  {status && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {users.map((m) => m.user.name).join(", ")}
                </p>
                <p className="text-xs text-gray-300 mt-0.5">
                  {new Date(room.updatedAt).toLocaleString("ja-JP")}
                </p>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t">
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">
            ログアウト
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {activeRoom ? (
          <>
            <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">
                  {activeRoom.name ?? "HR相談"}
                </h2>
                <p className="text-xs text-gray-400">
                  参加者: {activeRoom.members?.map((m) => m.user.name).join(", ")}
                </p>
              </div>
              {!activeRoom.members?.some((m) => m.user.id === user?.id) && (
                <button
                  onClick={() => joinRoom(activeRoom.id)}
                  className="btn-primary text-sm"
                >
                  このチャットに参加
                </button>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatWindow
                key={activeRoom.id}
                roomId={activeRoom.id}
                socket={socket}
                currentUser={user!}
                initialMessages={roomMessages}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-5xl mb-3">💬</div>
              <p className="text-lg font-medium text-gray-600">チャットルームを選択してください</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
