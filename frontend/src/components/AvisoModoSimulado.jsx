import { USAR_MOCK } from '../api/cliente.js';

/** Faixa visível só com VITE_USAR_MOCK=true */
export function AvisoModoSimulado() {
  if (!USAR_MOCK) return null;

  async function restaurar() {
    const { restaurarDadosMock } = await import('../api/mock/servidor.js');
    restaurarDadosMock();
    window.location.reload();
  }

  return (
    <aside aria-label="Aviso de demonstração" className="bg-media px-4 py-2 text-center text-sm text-media-texto">
      Modo de demonstração: os dados são simulados e ficam só neste navegador.{' '}
      <button type="button" onClick={restaurar} className="font-bold underline underline-offset-2">
        Restaurar dados de exemplo
      </button>
    </aside>
  );
}
