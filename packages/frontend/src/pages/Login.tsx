import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "ログインに失敗しました";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const demoUsers = [
    { email: "user1@sakura.co", role: "一般ユーザー", color: "bg-blue-50 text-blue-700" },
    { email: "operator1@sakura.co", role: "オペレータ", color: "bg-green-50 text-green-700" },
    { email: "supervisor@sakura.co", role: "スーパーバイザー", color: "bg-purple-50 text-purple-700" },
    { email: "admin@sakura.co", role: "システム管理者", color: "bg-red-50 text-red-700" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sakura-50 to-pink-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌸</div>
          <h1 className="text-3xl font-bold text-sakura-700">さくらスペース HR</h1>
          <p className="text-gray-500 mt-1">HRアシスタントポータル</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sakura-400"
                placeholder="email@sakura.co"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sakura-400"
                required
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-center"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>
        </div>

        <div className="card p-4 mt-4">
          <p className="text-xs text-gray-500 mb-3 font-medium">デモアカウント（password: password123）</p>
          <div className="space-y-2">
            {demoUsers.map((u) => (
              <button
                key={u.email}
                onClick={() => { setEmail(u.email); setPassword("password123"); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${u.color} hover:opacity-80 transition-opacity`}
              >
                <span className="font-medium">{u.role}</span>
                <span className="ml-2 opacity-70">{u.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
