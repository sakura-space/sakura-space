import { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/auth";
import { getSocket, disconnectSocket } from "../../api/socket";
import ChatWindow, { ChatMessage } from "../../components/ChatWindow";
import api from "../../api/client";

interface Room {
  id: string;
  name: string | null;
  updatedAt: string;
  agentSessions: { status: string }[];
  messages: ChatMessage[];
}

export default function UserChat() {
  const { user, logout } = useAuthStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomMessages, setRoomMessages] = useState<ChatMessage[]>([]);
  const socket = getSocket();

  useEffect(() => {
    fetchRooms();
    return () => disconnectSocket();
  }, []);

  const fetchRooms = async () => {
    const { data } = await api.get("/rooms");
    setRooms(data);
  };

  const openRoom = async (room: Room) => {
    const { data } = await api.get(`/rooms/${room.id}`);
    setActiveRoom(data);
    setRoomMessages(data.messages ?? []);
  };

  const createRoom = async () => {
    const { data } = await api.post("/rooms", { name: "HR相談" });
    setRooms((prev) => [data, ...prev]);
    openRoom(data);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b bg-sakura-500">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌸</span>
            <div>
              <h1 className="text-white font-bold text-sm">さくらスペース HR</h1>
              <p className="text-sakura-100 text-xs">{user?.name}</p>
            </div>
          </div>
        </div>

        <div className="p-3">
          <button onClick={createRoom} className="btn-primary w-full text-sm">
            + 新しい相談を開始
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rooms.map((room) => {
            const session = room.agentSessions?.[0];
            return (
              <button
                key={room.id}
                onClick={() => openRoom(room)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b transition-colors ${
                  activeRoom?.id === room.id ? "bg-sakura-50 border-l-2 border-l-sakura-400" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-gray-800">
                    {room.name ?? "HR相談"}
                  </p>
                  {session?.status === "ESCALATED" && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                      転送中
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(room.updatedAt).toLocaleDateString("ja-JP")}
                </p>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t">
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600 w-full text-left">
            ログアウト
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {activeRoom ? (
          <>
            <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">{activeRoom.name ?? "HR相談"}</h2>
                <p className="text-xs text-gray-400">
                  /hr コマンドでHRエージェントを呼び出せます
                </p>
              </div>
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
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-6xl mb-4">🌸</div>
              <p className="text-xl font-medium text-gray-600">HR相談を開始しましょう</p>
              <p className="text-sm mt-2">
                左のサイドバーから相談を選ぶか、新しい相談を作成してください
              </p>
              <button onClick={createRoom} className="btn-primary mt-6">
                新しい相談を開始
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
