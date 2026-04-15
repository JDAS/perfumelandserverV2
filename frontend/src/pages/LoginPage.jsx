import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { login } from '../services/authService';
import { useToast } from '../components/ui/ToastContext';

function LoginPage() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to={user.isAdmin ? '/admin' : '/'} />;
  }

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.password) {
      addToast('Debes completar email y contraseña', 'warning');
      return;
    }

    try {
      setLoading(true);

      const data = await login(form);

      setAuth({
        user: data.user,
        token: data.token,
      });

      navigate(data.user?.isAdmin ? '/admin' : '/');
    } catch (error) {
      console.error(error);
      addToast(error?.response?.data?.message || 'Error al iniciar sesión', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold mb-2">Iniciar sesión</h1>
        <p className="text-sm text-gray-500 mb-6">Accede a tu cuenta para continuar</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">Correo</label>
            <input
              type="email"
              name="email"
              className="w-full border rounded-lg p-3"
              value={form.email}
              onChange={handleChange}
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium">Contraseña</label>
            <input
              type="password"
              name="password"
              className="w-full border rounded-lg p-3"
              value={form.password}
              onChange={handleChange}
              placeholder="********"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded-lg py-3 disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
