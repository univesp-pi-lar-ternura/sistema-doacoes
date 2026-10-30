import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { AvisoModoSimulado } from '../AvisoModoSimulado.jsx';
import { primeiroNome } from '../../utils/formatar.js';

const LINKS = [
  { para: '/admin', texto: 'Início', fim: true },
  { para: '/admin/agendamentos', texto: 'Doações agendadas' },
  { para: '/admin/registrar', texto: 'Registrar doação' },
  { para: '/admin/necessidades', texto: 'Necessidades' },
  { para: '/admin/produtos', texto: 'Produtos' },
  { para: '/admin/situacao', texto: 'Situação das necessidades' },
  { para: '/admin/relatorio', texto: 'Relatório do mês' },
];

const estiloLink = ({ isActive }) => `flex min-h-11 items-center rounded-lg px-3 font-bold ${
  isActive ? 'bg-lar text-white' : 'text-tinta hover:bg-lar-claro'}`;

export function LayoutAdmin() {
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-nevoa">
      <a href="#conteudo" className="pular-link">Pular para o conteúdo</a>
      <AvisoModoSimulado />
      <header className="border-b-4 border-marca-laranja bg-papel">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="flex items-center gap-3 font-titulo text-lg font-extrabold">
            <img src="/logo-lar-ternura-192.png" alt="" width="44" height="44" className="size-11" />
            Painel do Lar Ternura
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-tinta-suave">{primeiroNome(usuario.nome) || usuario.email}</span>
            <button type="button" onClick={async () => { await sair(); navegar('/admin/entrar'); }}
              className="min-h-11 rounded-lg border-2 border-linha-forte px-4 font-bold hover:bg-nevoa">
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Menu do painel" className="min-w-0">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {LINKS.map((l) => (
              <li key={l.para} className="shrink-0">
                <NavLink to={l.para} end={l.fim} className={estiloLink}>{l.texto}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="conteudo" tabIndex={-1} className="min-w-0 outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Cabeçalho padrão das páginas do painel. */
export function CabecalhoPagina({ titulo, descricao, acao }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">{titulo}</h1>
        {descricao && <p className="mt-1 max-w-2xl text-tinta-suave">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Painel({ children, className = '' }) {
  return <div className={`rounded-xl border border-linha bg-papel p-5 ${className}`}>{children}</div>;
}
