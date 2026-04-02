import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

function AdminRoute({ children }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;