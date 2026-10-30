import { Link, NavLink, Outlet } from 'react-router-dom';
import { AvisoModoSimulado } from '../AvisoModoSimulado.jsx';
import { CONTATO, LOCAL_ENTREGA, linkWhatsApp } from '../../config.js';

const estiloMenu = ({ isActive }) => `inline-flex min-h-11 items-center rounded-lg px-3 font-bold no-underline ${
  isActive ? 'bg-marca-amarelo text-marca-escuro' : 'text-tinta hover:bg-lar-claro'}`;

export function LayoutPublico() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#conteudo" className="pular-link">Pular para o conteúdo</a>
      <AvisoModoSimulado />
      <header className="border-b-4 border-marca-laranja bg-papel">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-3 rounded-md no-underline">
            <img src="/logo-lar-ternura-192.png" alt="" width="56" height="56" className="size-14" />
            <span className="leading-tight">
              <span className="block font-titulo text-xl font-extrabold">Lar Ternura</span>
              <span className="block text-sm text-tinta-suave">Doações</span>
            </span>
          </Link>

          <nav aria-label="Principal" className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <ul className="flex flex-wrap gap-1">
              <li><NavLink to="/" end className={estiloMenu}>Início</NavLink></li>
              <li><NavLink to="/doar" className={estiloMenu}>Quero doar</NavLink></li>
            </ul>
            <Link to="/admin"
              className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg border-2 border-linha-forte px-3 text-sm font-bold text-tinta no-underline hover:bg-nevoa">
              <Cadeado />
              <span className="sm:hidden">Equipe</span>
              <span className="hidden sm:inline">Acesso da equipe</span>
            </Link>
          </nav>
        </div>
      </header>

      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>

      <footer className="mt-12 bg-marca-escuro text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="font-titulo text-lg font-extrabold text-marca-amarelo">Associação Lar Ternura</p>
            <p className="mt-1">Acolhe jovens e adultos com deficiência na Zona Oeste de São Paulo.</p>
          </div>
          <div>
            <p className="font-bold text-marca-amarelo">Onde entregar</p>
            <p className="mt-1">{LOCAL_ENTREGA.endereco}</p>
            <a href={LOCAL_ENTREGA.mapa} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center underline underline-offset-2">
              Ver no mapa<span className="so-leitor"> (abre em nova aba)</span>
            </a>
          </div>
          <div>
            <p className="font-bold text-marca-amarelo">Fale com o Lar</p>
            <ul className="mt-1">
              <li>
                <a href={`tel:+55${CONTATO.telefone.replace(/\D/g, '')}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                  Telefone {CONTATO.telefone}
                </a>
              </li>
              <li>
                <a href={linkWhatsApp(CONTATO.whatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2">
                  WhatsApp {CONTATO.whatsapp}<span className="so-leitor"> (abre em nova aba)</span>
                </a>
              </li>
              <li>
                <a href={CONTATO.site} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2">
                  Site oficial: larternura.org.br<span className="so-leitor"> (abre em nova aba)</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Cadeado() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
