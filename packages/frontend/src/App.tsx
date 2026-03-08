import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/auth";
import Login from "./pages/Login";
import UserChat from "./pages/user/UserChat";
import OperatorChat from "./pages/operator/OperatorChat";
import OperatorMonitor from "./pages/operator/OperatorMonitor";
import AdminConsole from "./pages/admin/AdminConsole";

function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { user, token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role))
    return <Navigate to="/" replace />;
  return <>{children}</>;
}

function DefaultRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  if (user.role === "SUPERVISOR") return <Navigate to="/monitor" replace />;
  if (user.role === "OPERATOR") return <Navigate to="/operator" replace />;
  return <Navigate to="/chat" replace />;
}

export default function App() {
  const { loadMe, token } = useAuthStore();

  useEffect(() => {
    if (token) loadMe();
  }, [token]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<DefaultRedirect />} />
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <UserChat />
            </RequireAuth>
          }
        />
        <Route
          path="/operator"
          element={
            <RequireAuth roles={["OPERATOR", "SUPERVISOR", "ADMIN"]}>
              <OperatorChat />
            </RequireAuth>
          }
        />
        <Route
          path="/monitor"
          element={
            <RequireAuth roles={["SUPERVISOR", "ADMIN"]}>
              <OperatorMonitor />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth roles={["ADMIN"]}>
              <AdminConsole />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
