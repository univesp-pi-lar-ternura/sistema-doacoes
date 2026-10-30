import { Campo } from '../ui/Campo.jsx';
import { MEDIDAS, UNIDADES_CONTAGEM, descreverEquivalencia, montarNome } from '../../utils/apresentacao.js';

export const APRESENTACAO_VAZIA = { produto: '', contagem: '', conteudo: '', medida: 'g' };

/** Nome e unidade de contagem que vão para a API, a partir dos campos estruturados. */
export function resultadoApresentacao(a) {
  const par = UNIDADES_CONTAGEM.find(([s]) => s === a.contagem);
  return {
    nome_item: montarNome({ produto: a.produto, embalagem: a.contagem, conteudo: a.conteudo, medida: a.medida }),
    unidade_medida: par ? par[1] : '',
  };
}

/** Erros dos campos estruturados, nas chaves usadas pelos Campos abaixo. */
export function validarApresentacao(a) {
  const erros = {};
  if (!a.produto.trim()) erros.produto = 'Informe o produto, sem a embalagem. Ex.: Macarrão espaguete.';
  if (!a.contagem) erros.contagem = 'Escolha como o produto é contado ao chegar.';
  const texto = String(a.conteudo).trim();
  if (texto) {
    const n = Number(texto.replace(',', '.'));
    if (!(n > 0)) erros.conteudo = 'Use um número maior que zero, como 500 ou 1,5.';
    else if (a.medida === 'un' && !Number.isInteger(n)) erros.conteudo = 'Para unidades dentro da embalagem, use um número inteiro.';
  }
  if (resultadoApresentacao(a).nome_item.length > 120) erros.produto = 'O nome completo passou de 120 caracteres. Encurte o produto.';
  return erros;
}

/** Lista fechada de unidades de contagem. `atual` mantém um valor antigo fora da lista. */
export function SelecionarUnidade({ valor, aoMudar, excluir, atual }) {
  const opcoes = UNIDADES_CONTAGEM.filter(([, plural]) => plural !== excluir);
  const foraDaLista = atual && !UNIDADES_CONTAGEM.some(([, p]) => p === atual) && atual !== excluir;
  return (
    <select value={valor} onChange={(e) => aoMudar(e.target.value)}>
      <option value="">Escolha</option>
      {foraDaLista && <option value={atual}>{atual}</option>}
      {opcoes.map(([singular, plural]) => <option key={plural} value={plural}>{plural} (1 {singular})</option>)}
    </select>
  );
}

/**
 * Cadastro guiado: produto, como é contado e o conteúdo de cada unidade.
 * O front monta o nome no padrão "Macarrão espaguete, pacote de 500 g".
 */
export function CamposApresentacao({ valor, aoMudar, erros = {} }) {
  const mudar = (campo) => (e) => aoMudar({ ...valor, [campo]: e.target.value });
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-lg font-bold">Produto e embalagem</legend>
      <Campo id="apr-produto" rotulo="Produto" obrigatorio erro={erros.produto} dica="O que é, sem a embalagem. Ex.: Macarrão espaguete.">
        <input type="text" value={valor.produto} onChange={mudar('produto')} maxLength={90} autoComplete="off" />
      </Campo>
      <Campo id="apr-contagem" rotulo="Como é contado ao chegar" obrigatorio erro={erros.contagem}
        dica="As metas, os agendamentos e as doações sempre usam esta unidade, em números inteiros.">
        <select value={valor.contagem} onChange={mudar('contagem')}>
          <option value="">Escolha</option>
          {UNIDADES_CONTAGEM.map(([singular, plural]) => <option key={singular} value={singular}>Por {singular} ({plural})</option>)}
        </select>
      </Campo>
      <fieldset aria-describedby="apr-conteudo-dica">
        <legend className="font-bold">Conteúdo de cada {valor.contagem || 'unidade'} (opcional)</legend>
        <p id="apr-conteudo-dica" className="text-sm text-tinta-suave">Ex.: 500 g, 1 L, 8 unidades. Com peso ou volume, a tela mostra a equivalência.</p>
        <div className="mt-2 flex flex-wrap items-start gap-3">
          <Campo id="apr-conteudo" rotulo="Quantidade" erro={erros.conteudo} className="w-32">
            <input type="text" inputMode="decimal" value={valor.conteudo} onChange={mudar('conteudo')} maxLength={8} />
          </Campo>
          <Campo id="apr-medida" rotulo="Medida" className="min-w-56">
            <select value={valor.medida} onChange={mudar('medida')}>
              {Object.entries(MEDIDAS).map(([chave, m]) => <option key={chave} value={chave}>{m.rotulo}</option>)}
            </select>
          </Campo>
        </div>
      </fieldset>
    </fieldset>
  );
}

/** Como o produto vai aparecer em todas as telas, com a equivalência quando houver. */
export function PreviaProduto({ nome, unidade }) {
  const equivalencia = nome && unidade ? descreverEquivalencia(nome, unidade) : null;
  return (
    <div aria-live="polite" className="rounded-lg border-2 border-linha bg-nevoa px-4 py-3">
      {nome && unidade ? (
        <>
          <p><span className="text-tinta-suave">Vai aparecer como:</span> <strong>{nome}</strong></p>
          <p><span className="text-tinta-suave">Contado em:</span> <strong>{unidade}</strong></p>
          {equivalencia && <p className="mt-1">{equivalencia}</p>}
        </>
      ) : (
        <p className="text-tinta-suave">Preencha o produto e como ele é contado para ver como vai aparecer.</p>
      )}
    </div>
  );
}
