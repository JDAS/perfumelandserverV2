import { useAuthStore } from "../store/authStore";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/" />;
  }

  return children;
}

export default ProtectedRoute;