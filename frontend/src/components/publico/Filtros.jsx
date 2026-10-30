import { ESTILO_CAMPO } from '../ui/Campo.jsx';
import { estiloUrgencia } from '../../utils/urgencia.js';

const chip = 'flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-linha-forte px-4 py-1 '
  + 'has-[:checked]:border-lar has-[:checked]:bg-lar has-[:checked]:text-white has-[:focus-visible]:outline '
  + 'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lar';

export function Filtros({ opcoes, valores, aoMudar }) {
  const alternarNivel = (nivel) => {
    const niveis = valores.niveis.includes(nivel)
      ? valores.niveis.filter((n) => n !== nivel)
      : [...valores.niveis, nivel];
    aoMudar({ ...valores, niveis });
  };
  const algumFiltro = valores.busca || valores.niveis.length || valores.categoria;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <label htmlFor="busca" className="font-bold">Buscar produto</label>
        <input
          id="busca"
          type="search"
          value={valores.busca}
          onChange={(e) => aoMudar({ ...valores, busca: e.target.value })}
          placeholder="Ex.: fralda, leite"
          className={`${ESTILO_CAMPO} border-linha-forte`}
          autoComplete="off"
        />
      </div>

      <fieldset>
        <legend className="mb-2 font-bold">Prioridade</legend>
        <div className="flex flex-wrap gap-2">
          {(opcoes?.urgencias ?? []).map((u) => (
            <label key={u.nivel} className={chip}>
              <input type="checkbox" className="so-leitor" checked={valores.niveis.includes(u.nivel)}
                onChange={() => alternarNivel(u.nivel)} />
              {estiloUrgencia(u.nivel).rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-bold">Tipo de produto</legend>
        <div className="flex flex-wrap gap-2">
          {['', ...(opcoes?.categorias ?? [])].map((c) => (
            <label key={c || 'todas'} className={chip}>
              <input type="radio" name="categoria" className="so-leitor" checked={valores.categoria === c}
                onChange={() => aoMudar({ ...valores, categoria: c })} />
              {c || 'Todos'}
            </label>
          ))}
        </div>
      </fieldset>

      {algumFiltro && (
        <button type="button" onClick={() => aoMudar({ busca: '', niveis: [], categoria: '' })}
          className="min-h-11 self-start rounded-md font-bold text-lar underline underline-offset-4">
          Limpar filtros
        </button>
      )}
    </div>
  );
}
