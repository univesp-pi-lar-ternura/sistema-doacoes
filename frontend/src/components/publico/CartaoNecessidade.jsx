import { useState } from 'react';
import { useDoacao } from '../../contexts/DoacaoContext.jsx';
import { BarraProgresso } from '../ui/BarraProgresso.jsx';
import { SeloUrgencia } from '../ui/SeloUrgencia.jsx';
import { SeletorQuantidade } from '../ui/SeletorQuantidade.jsx';
import { Botao } from '../ui/Botao.jsx';
import { formatarNumero, formatarPercentual } from '../../utils/formatar.js';
import { estiloUrgencia } from '../../utils/urgencia.js';
import { quantidadeValida } from '../../utils/validar.js';

export function CartaoNecessidade({ necessidade: n }) {
  const { quantidadeDe, definirQuantidade, remover } = useDoacao();
  const naDoacao = quantidadeDe(n.id_item);
  const [quantidade, setQuantidade] = useState(naDoacao || 1);
  const [editando, setEditando] = useState(false);
  const idQtd = `qtd-${n.id_item}`;
  const valida = quantidadeValida(quantidade);

  function confirmar() {
    if (!valida) return;
    definirQuantidade(n, quantidade);
    setEditando(false);
  }

  return (
    <article className={`flex flex-col gap-4 rounded-xl border border-linha bg-papel p-5 ${naDoacao ? 'ring-2 ring-lar' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-bold leading-snug">{n.nome_item}</h3>
        <SeloUrgencia nivel={n.urgencia.nivel} nome={estiloUrgencia(n.urgencia.nivel).rotulo} />
      </div>

      <div>
        {n.meta_atingida ? (
          <p className="text-2xl font-bold text-sucesso">Meta atingida</p>
        ) : (
          <p className="text-2xl font-bold">
            Faltam {formatarNumero(n.quantidade_faltante)} <span className="text-lg">{n.unidade_medida}</span>
          </p>
        )}
        <div className="mt-2">
          <BarraProgresso valor={n.percentual_barra} nivel={n.urgencia.nivel} alta
            rotulo={`${n.nome_item}: ${formatarPercentual(n.percentual_atendimento)} da meta arrecadado`} />
        </div>
        <p className="mt-2 text-tinta-suave">
          {formatarNumero(n.quantidade_arrecadada)} de {formatarNumero(n.quantidade_meta)} {n.unidade_medida} ({formatarPercentual(n.percentual_atendimento)})
          {n.meta_atingida && '. Doações extras ainda ajudam.'}
        </p>
      </div>

      <div className="mt-auto border-t border-linha pt-4">
        {naDoacao && !editando ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-lar">Na sua doação: {formatarNumero(naDoacao)} {n.unidade_medida}</p>
            <div className="flex gap-2">
              <Botao variante="discreto" onClick={() => { setQuantidade(naDoacao); setEditando(true); }}>Alterar</Botao>
              <Botao variante="discreto" onClick={() => remover(n.id_item)}>Retirar</Botao>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label htmlFor={idQtd} className="font-bold">Quantas {n.unidade_medida} você pode doar?</label>
            <SeletorQuantidade id={idQtd} valor={quantidade} aoMudar={setQuantidade}
              rotulo={`quantidade de ${n.nome_item}`} unidade={n.unidade_medida} erro={!valida} />
            {!valida && <p className="text-sm font-bold text-erro">Use um número inteiro de 1 a 9999.</p>}
            <Botao onClick={confirmar} disabled={!valida} largo>
              {naDoacao ? 'Salvar quantidade' : 'Incluir na minha doação'}
            </Botao>
          </div>
        )}
      </div>
    </article>
  );
}
