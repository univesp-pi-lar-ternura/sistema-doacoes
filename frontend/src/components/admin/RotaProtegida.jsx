import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { Carregando } from '../ui/Estados.jsx';

/** Só usuários com sessão ativa. A API aceita apenas o cargo Administrador. */
export function RotaProtegida() {
  const { usuario, carregando } = useAuth();
  const local = useLocation();

  if (carregando) return <Carregando texto="Verificando acesso…" />;
  if (!usuario) return <Navigate to="/admin/entrar" replace state={{ voltarPara: local.pathname }} />;
  return <Outlet />;
}
