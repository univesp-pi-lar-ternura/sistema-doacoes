import { useId, useState } from 'react';
import { Botao } from '../ui/Botao.jsx';
import { ESTILO_CAMPO } from '../ui/Campo.jsx';
import { MEDIDAS, contar, converter, lerConteudo } from '../../utils/apresentacao.js';

/**
 * "Chegou em kg ou litros?": converte peso/volume para a unidade de contagem do produto.
 * Só ajuda a contar: o valor gravado continua sendo um número inteiro de unidades.
 * Aparece apenas quando o nome do produto traz o conteúdo (ex.: "pacote de 500 g").
 */
export function AjudaConversao({ nome, unidade, aoUsar, maximo }) {
  const conteudo = lerConteudo(nome);
  if (!conteudo) return null;
  return <Conversor conteudo={conteudo} unidade={unidade} aoUsar={aoUsar} maximo={maximo} />;
}

function Conversor({ conteudo, unidade, aoUsar, maximo }) {
  const id = useId();
  const medidas = Object.entries(MEDIDAS).filter(([, m]) => m.base === conteudo.base);
  const [valor, setValor] = useState('');
  const [medida, setMedida] = useState(medidas.at(-1)[0]); // kg ou L
  const n = Number(String(valor).replace(',', '.'));
  const r = valor ? converter(n, medida, conteudo) : null;
  const acima = r?.exato && maximo !== undefined && r.unidades > maximo;

  return (
    <details className="rounded-lg bg-nevoa px-3 py-2">
      <summary className="min-h-11 cursor-pointer content-center font-bold text-lar">
        Chegou em {conteudo.base === 'g' ? 'quilos ou gramas' : 'litros ou mililitros'}? Converter
      </summary>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-qtd`} className="text-sm font-bold">Quantidade</label>
          <input id={`${id}-qtd`} type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
            className={`${ESTILO_CAMPO} w-28 border-linha-forte`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-medida`} className="text-sm font-bold">Medida</label>
          <select id={`${id}-medida`} value={medida} onChange={(e) => setMedida(e.target.value)}
            className={`${ESTILO_CAMPO} w-auto border-linha-forte`}>
            {medidas.map(([chave]) => <option key={chave} value={chave}>{chave}</option>)}
          </select>
        </div>
      </div>
      <div aria-live="polite" className="mt-2">
        {r && r.exato && !acima && (
          <div className="flex flex-wrap items-center gap-3">
            <p><strong>{valor} {medida} = {contar(r.unidades, unidade)}</strong></p>
            <Botao variante="secundario" onClick={() => aoUsar(r.unidades)}>Usar {contar(r.unidades, unidade)}</Botao>
          </div>
        )}
        {r && r.exato && acima && (
          <p>{valor} {medida} = {contar(r.unidades, unidade)}, mais do que o esperado ({contar(maximo, unidade)}). Registre o excedente como doação avulsa.</p>
        )}
        {r && !r.exato && (
          <p>{valor} {medida} dá {String(r.unidades).replace('.', ',')} {unidade}, que não é um número inteiro. Confira a contagem das embalagens.</p>
        )}
        {valor && !r && <p className="text-sm text-erro">Use um número maior que zero, como 3 ou 1,5.</p>}
      </div>
    </details>
  );
}
