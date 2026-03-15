import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/chat",     label: "質問者",         icon: "💬", roles: ["USER", "OPERATOR", "SUPERVISOR", "ADMIN"] },
  { to: "/operator", label: "有人オペレータ", icon: "👤", roles: ["OPERATOR", "SUPERVISOR", "ADMIN"] },
  { to: "/monitor",  label: "エージェント監視", icon: "📊", roles: ["SUPERVISOR", "ADMIN"] },
  { to: "/admin",    label: "システム管理者",  icon: "⚙️", roles: ["ADMIN"] },
];

export default function NavMenu() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const current = visibleItems.find((item) => location.pathname === item.to);

  return (
    <div ref={ref} className="fixed top-3 right-4 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-white/90 backdrop-blur border border-gray-200 shadow-md rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
      >
        <span>{current?.icon ?? "🌸"}</span>
        <span className="max-w-[8rem] truncate">{current?.label ?? "メニュー"}</span>
        <svg
          className={`w-4 h-4 transition-transform text-gray-400 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500">画面切り替え</p>
            <p className="text-xs text-gray-400 truncate">{user.name}</p>
          </div>

          <div className="py-1">
            {visibleItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <button
                  key={item.to}
                  onClick={() => { navigate(item.to); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    isActive
                      ? "bg-sakura-50 text-sakura-600 font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sakura-400" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-gray-100 py-1">
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <span className="text-base">🚪</span>
              <span>ログアウト</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
