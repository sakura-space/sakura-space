import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../stores/auth";
import api from "../../api/client";

type Role = "USER" | "OPERATOR" | "SUPERVISOR" | "ADMIN";
type ApiType = "SMARTHR" | "SERVICENOW";

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

interface Permission {
  id: string;
  role: Role;
  api: ApiType;
  action: string;
  enabled: boolean;
  label: string;
}

const ROLE_COLORS: Record<Role, string> = {
  USER: "bg-blue-100 text-blue-700",
  OPERATOR: "bg-green-100 text-green-700",
  SUPERVISOR: "bg-purple-100 text-purple-700",
  ADMIN: "bg-red-100 text-red-700",
};

const API_COLORS: Record<ApiType, string> = {
  SMARTHR: "bg-orange-100 text-orange-700",
  SERVICENOW: "bg-cyan-100 text-cyan-700",
};

export default function AdminConsole() {
  const { user, logout } = useAuthStore();
  const [tab, setTab] = useState<"users" | "permissions">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [filterRole, setFilterRole] = useState<Role | "ALL">("ALL");
  const [newUser, setNewUser] = useState({ email: "", name: "", password: "", role: "USER" as Role });
  const [showNewUser, setShowNewUser] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
  }, []);

  const fetchUsers = async () => {
    const { data } = await api.get("/admin/users");
    setUsers(data);
  };

  const fetchPermissions = async () => {
    const { data } = await api.get("/admin/permissions");
    setPermissions(data);
  };

  const togglePermission = async (perm: Permission) => {
    setSaving(perm.id);
    try {
      const { data } = await api.patch(`/admin/permissions/${perm.id}`, {
        enabled: !perm.enabled,
      });
      setPermissions((prev) => prev.map((p) => (p.id === data.id ? data : p)));
    } finally {
      setSaving(null);
    }
  };

  const changeRole = async (userId: string, role: Role) => {
    await api.patch(`/admin/users/${userId}/role`, { role });
    fetchUsers();
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("このユーザーを削除しますか？")) return;
    await api.delete(`/admin/users/${userId}`);
    fetchUsers();
  };

  const createUser = async () => {
    if (!newUser.email || !newUser.name || !newUser.password) return;
    await api.post("/admin/users", newUser);
    setNewUser({ email: "", name: "", password: "", role: "USER" });
    setShowNewUser(false);
    fetchUsers();
  };

  const roles: Role[] = ["USER", "OPERATOR", "SUPERVISOR", "ADMIN"];
  const filteredPerms = permissions.filter(
    (p) => filterRole === "ALL" || p.role === filterRole
  );

  // Group permissions by role→api
  const permsByRole: Partial<Record<Role, Partial<Record<ApiType, Permission[]>>>> = {};
  for (const p of filteredPerms) {
    if (!permsByRole[p.role]) permsByRole[p.role] = {};
    if (!permsByRole[p.role]![p.api]) permsByRole[p.role]![p.api] = [];
    permsByRole[p.role]![p.api]!.push(p);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-700 text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <div>
              <h1 className="font-bold text-lg">システム管理画面</h1>
              <p className="text-red-200 text-xs">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/monitor" className="text-xs bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded">
              エージェント監視
            </Link>
            <Link to="/operator" className="text-xs bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded">
              オペレータ
            </Link>
            <button onClick={logout} className="text-xs text-red-300 hover:text-white">
              ログアウト
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm border border-gray-200 w-fit">
          <button
            onClick={() => setTab("users")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "users" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            👥 ユーザー管理
          </button>
          <button
            onClick={() => setTab("permissions")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "permissions" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            🔑 API権限管理
          </button>
        </div>

        {/* Users tab */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">ユーザー一覧 ({users.length}人)</h2>
              <button
                onClick={() => setShowNewUser(!showNewUser)}
                className="btn-primary text-sm"
              >
                + ユーザーを追加
              </button>
            </div>

            {showNewUser && (
              <div className="card p-5">
                <h3 className="font-semibold mb-4 text-gray-700">新規ユーザー作成</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">メールアドレス</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">名前</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">パスワード</label>
                    <input
                      type="password"
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ロール</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
                    >
                      {roles.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={createUser} className="btn-primary text-sm">作成</button>
                  <button onClick={() => setShowNewUser(false)} className="btn-secondary text-sm">キャンセル</button>
                </div>
              </div>
            )}

            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">名前</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">メール</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ロール</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">登録日</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-gray-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value as Role)}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${ROLE_COLORS[u.role]}`}
                          disabled={u.id === user?.id}
                        >
                          {roles.map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(u.createdAt).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            削除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Permissions tab */}
        {tab === "permissions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">API権限設定</h2>
              <div className="flex gap-2">
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as Role | "ALL")}
                  className="border rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="ALL">全ロール</option>
                  {roles.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              ⚠️ 権限の変更は即座に反映されます。エージェントは次の会話から変更された権限を使用します。
            </div>

            {(Object.entries(permsByRole) as [Role, Partial<Record<ApiType, Permission[]>>][]).map(
              ([role, apiPerms]) => (
                <div key={role} className="card overflow-hidden">
                  <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[role]}`}>
                      {role}
                    </span>
                    <span className="text-sm text-gray-500">ロールの権限設定</span>
                  </div>
                  <div className="p-5 space-y-5">
                    {(["SMARTHR", "SERVICENOW"] as ApiType[]).map((apiType) => {
                      const perms = apiPerms[apiType] ?? [];
                      if (perms.length === 0) return null;
                      return (
                        <div key={apiType}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${API_COLORS[apiType]}`}>
                              {apiType}
                            </span>
                            <span className="text-xs text-gray-400">API</span>
                          </div>
                          <div className="space-y-2">
                            {perms.map((perm) => (
                              <div key={perm.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                                <div>
                                  <p className="text-sm font-medium text-gray-700">{perm.label}</p>
                                  <p className="text-xs text-gray-400 font-mono">{perm.action}</p>
                                </div>
                                <button
                                  onClick={() => togglePermission(perm)}
                                  disabled={saving === perm.id}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    perm.enabled ? "bg-green-500" : "bg-gray-300"
                                  } ${saving === perm.id ? "opacity-50" : ""}`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      perm.enabled ? "translate-x-6" : "translate-x-1"
                                    }`}
                                  />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
