import { lazy, Suspense, useEffect, useRef } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { DoacaoProvider } from './contexts/DoacaoContext.jsx';
import { LayoutPublico } from './components/publico/LayoutPublico.jsx';
import { Carregando } from './components/ui/Estados.jsx';
import { BotaoLink } from './components/ui/Botao.jsx';
import PaginaInicial from './pages/publico/PaginaInicial.jsx';

const Termometro = lazy(() => import('./pages/publico/Termometro.jsx'));
const Agendar = lazy(() => import('./pages/publico/Agendar.jsx'));
const AgendamentoConfirmado = lazy(() => import('./pages/publico/AgendamentoConfirmado.jsx'));
const MeuAgendamento = lazy(() => import('./pages/publico/MeuAgendamento.jsx'));
const Entrar = lazy(() => import('./pages/admin/Entrar.jsx'));
const RotaProtegida = lazy(() => import('./components/admin/RotaProtegida.jsx').then((m) => ({ default: m.RotaProtegida })));
const LayoutAdmin = lazy(() => import('./components/admin/LayoutAdmin.jsx').then((m) => ({ default: m.LayoutAdmin })));
const Inicio = lazy(() => import('./pages/admin/Inicio.jsx'));
const Agendamentos = lazy(() => import('./pages/admin/Agendamentos.jsx'));
const RegistrarDoacao = lazy(() => import('./pages/admin/RegistrarDoacao.jsx'));
const Necessidades = lazy(() => import('./pages/admin/Necessidades.jsx'));
const Produtos = lazy(() => import('./pages/admin/Produtos.jsx'));
const Relatorio = lazy(() => import('./pages/admin/Relatorio.jsx'));
const Situacao = lazy(() => import('./pages/admin/Situacao.jsx'));

function GerenciarFoco() {
  const { pathname } = useLocation();
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    window.scrollTo(0, 0);
    document.getElementById('conteudo')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

function NaoEncontrada() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Página não encontrada</h1>
      <p className="mt-3 text-lg">O endereço pode estar errado ou a página mudou de lugar.</p>
      <BotaoLink to="/doar" className="mt-6">Ir para a página de doações</BotaoLink>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DoacaoProvider>
        <GerenciarFoco />
        <Suspense fallback={<Carregando />}>
          <Routes>
            <Route element={<LayoutPublico />}>
              <Route index element={<PaginaInicial />} />
              <Route path="doar" element={<Termometro />} />
              <Route path="agendar" element={<Agendar />} />
              <Route path="agendamento/confirmado" element={<AgendamentoConfirmado />} />
              <Route path="meu-agendamento/:id" element={<MeuAgendamento />} />
              <Route path="*" element={<NaoEncontrada />} />
            </Route>

            <Route path="admin/entrar" element={<Entrar />} />
            <Route path="admin" element={<RotaProtegida />}>
              <Route element={<LayoutAdmin />}>
                <Route index element={<Inicio />} />
                <Route path="agendamentos" element={<Agendamentos />} />
                <Route path="registrar" element={<RegistrarDoacao />} />
                <Route path="necessidades" element={<Necessidades />} />
                <Route path="produtos" element={<Produtos />} />
                <Route path="relatorio" element={<Relatorio />} />
                <Route path="situacao" element={<Situacao />} />
                <Route path="*" element={<NaoEncontrada />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </DoacaoProvider>
    </AuthProvider>
  );
}
