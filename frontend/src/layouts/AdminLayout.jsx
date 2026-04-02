import { Link } from "react-router-dom";
import UserMenu from "../components/UserMenu";

function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-black text-white p-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <Link to="/admin">
            <h1 className="text-2xl font-bold">Perfumeland</h1>
          </Link>

          <span className="text-sm text-gray-300">Admin</span>
        </div>

        <UserMenu />
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}

export default AdminLayout;