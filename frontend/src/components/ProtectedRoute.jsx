import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#08080A]">
        <div className="font-mono text-xs tracking-widest text-amber-500/80">
          [ INITIALISING CONTROL ROOM... ]
        </div>
      </div>
    );
  }
  if (user === false) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/app/executive" replace />;
  }
  return children;
}
