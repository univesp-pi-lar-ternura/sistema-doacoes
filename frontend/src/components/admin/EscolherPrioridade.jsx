import { estiloUrgencia } from '../../utils/urgencia.js';

const OPCOES = [
  { nivel: 1, descricao: 'Aparece no topo da lista para os doadores.' },
  { nivel: 2, descricao: 'Aparece depois dos urgentes.' },
  { nivel: 3, descricao: 'Aparece por último.' },
];

/** Radios de prioridade. `permitirPadrao` adiciona a opção "manter/usar a do produto" (valor null). */
export function EscolherPrioridade({ valor, aoMudar, nome, legenda = 'Prioridade', textoPadrao, erro }) {
  return (
    <fieldset aria-describedby={erro ? `${nome}-erro` : undefined}>
      <legend className="mb-2 font-bold">{legenda}</legend>
      <div className="flex flex-col gap-1">
        {textoPadrao && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="radio" name={nome} className="size-6 accent-lar" checked={valor == null} onChange={() => aoMudar(null)} />
            {textoPadrao}
          </label>
        )}
        {OPCOES.map((o) => (
          <label key={o.nivel} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="radio" name={nome} className="size-6 shrink-0 accent-lar" checked={valor === o.nivel} onChange={() => aoMudar(o.nivel)} />
            <span>
              <span className="font-bold">{estiloUrgencia(o.nivel).rotulo}</span>
              <span className="block text-sm text-tinta-suave">{o.descricao}</span>
            </span>
          </label>
        ))}
      </div>
      {erro && <p id={`${nome}-erro`} className="mt-1 text-sm font-bold text-erro">{erro}</p>}
    </fieldset>
  );
}
