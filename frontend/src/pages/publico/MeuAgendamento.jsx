import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { cancelarMeuAgendamento, consultarMeuAgendamento, remarcarMeuAgendamento } from '../../api/index.js';
import { useCarregar } from '../../hooks/useCarregar.js';
import { useTitulo } from '../../hooks/useTitulo.js';
import { Botao, BotaoLink } from '../../components/ui/Botao.jsx';
import { Alerta } from '../../components/ui/Alerta.jsx';
import { Dialogo } from '../../components/ui/Dialogo.jsx';
import { EscolherHorario } from '../../components/ui/EscolherHorario.jsx';
import { Carregando, ErroCarregamento } from '../../components/ui/Estados.jsx';
import { formatarData, formatarHora, formatarNumero } from '../../utils/formatar.js';
import { tokenLembrado } from '../../utils/meusAgendamentos.js';
import { LOCAL_ENTREGA } from '../../config.js';

const SITUACAO = {
  Pendente: 'Agendada. Aguardamos você no dia e horário marcados.',
  Confirmado: 'Confirmada pela equipe do Lar.',
  'Concluído': 'Entrega concluída. Obrigado pela doação!',
  Cancelado: 'Esta entrega foi cancelada.',
};

/** Página do doador, aberta pelo link privado: /meu-agendamento/{id}#{codigo}. */
export default function MeuAgendamento() {
  useTitulo('Minha entrega');
  const { id } = useParams();
  const token = window.location.hash.slice(1) || tokenLembrado(id);
  const ag = useCarregar(() => consultarMeuAgendamento(id, token), [id, token]);
  const [acao, setAcao] = useState(null); // 'remarcar' | 'cancelar'
  const [novo, setNovo] = useState({ data: '', horario: '' });
  const [erroAcao, setErroAcao] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [aviso, setAviso] = useState('');

  if (!token) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">Link incompleto</h1>
        <p className="mt-3 text-lg">Abra o link completo que apareceu quando você agendou. Ele termina com um código depois do símbolo #.</p>
        <BotaoLink to="/doar" className="mt-6">Ir para a página de doações</BotaoLink>
      </div>
    );
  }

  async function executar() {
    setProcessando(true);
    setErroAcao(null);
    try {
      if (acao === 'cancelar') {
        await cancelarMeuAgendamento(id, token);
        setAviso('Entrega cancelada.');
      } else {
        if (!novo.horario) throw new Error('Escolha o dia e um horário livre.');
        await remarcarMeuAgendamento(id, token, novo.data, novo.horario);
        setAviso('Horário alterado.');
      }
      setAcao(null);
      ag.recarregar();
    } catch (e) {
      setErroAcao(e);
    } finally {
      setProcessando(false);
    }
  }

  if (ag.carregando && !ag.dados) return <Carregando demorando={ag.demorando} />;
  if (ag.erro) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-6 text-3xl font-bold">Minha entrega</h1>
        <ErroCarregamento erro={ag.erro.status === 401 ? { message: 'Este link não é válido para este agendamento. Confira se copiou o link inteiro.' } : ag.erro}
          aoTentarDeNovo={ag.erro.status === 401 ? undefined : ag.recarregar} />
      </div>
    );
  }

  const a = ag.dados;
  const alteravel = ['Pendente', 'Confirmado'].includes(a.status_agendamento);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Minha entrega</h1>
      {aviso && <Alerta tipo="sucesso" className="mt-4">{aviso}</Alerta>}
      <p className="mt-4 text-lg">{SITUACAO[a.status_agendamento]}</p>

      <section className="mt-6 rounded-xl border border-linha p-6">
        <h2 className="text-xl font-bold">Código da entrega</h2>
        <p className="mt-1 text-3xl font-bold">#{a.id_agendamento}</p>
        <p className="mt-1 text-tinta-suave">Diga este número na portaria.</p>
        <h2 className="mt-6 text-xl font-bold">Quando</h2>
        <p className="mt-1 text-2xl font-bold first-letter:uppercase">
          {formatarData(a.data_hora_agendada)}, às {formatarHora(a.data_hora_agendada)}
        </p>
        <h2 className="mt-6 text-xl font-bold">Onde</h2>
        <p className="mt-1">{LOCAL_ENTREGA.nome}<br />{LOCAL_ENTREGA.endereco}</p>
        <h2 className="mt-6 text-xl font-bold">O que levar</h2>
        <ul className="mt-2 list-disc pl-6">
          {a.itens.map((i) => (
            <li key={i.id_item}><strong>{formatarNumero(i.quantidade_prometida)} {i.unidade_medida}</strong> de {i.nome_item}</li>
          ))}
        </ul>
      </section>

      {alteravel && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Botao variante="secundario" onClick={() => { setNovo({ data: '', horario: '' }); setAcao('remarcar'); }}>Mudar dia ou horário</Botao>
          <Botao variante="perigo" onClick={() => setAcao('cancelar')}>Cancelar entrega</Botao>
        </div>
      )}

      <Dialogo aberto={Boolean(acao)} aoFechar={() => { setAcao(null); setErroAcao(null); }}
        titulo={acao === 'cancelar' ? 'Cancelar esta entrega?' : 'Mudar dia ou horário'}>
        <div className="flex flex-col gap-4">
          {acao === 'cancelar' && <p>A equipe do Lar deixará de esperar por você. Não dá para desfazer.</p>}
          {acao === 'remarcar' && (
            <EscolherHorario data={novo.data} horario={novo.horario} idData="novo-dia" idHorario="novo-horario"
              aoMudar={setNovo} />
          )}
          {erroAcao && <Alerta tipo="erro">{erroAcao.message}</Alerta>}
          <div className="flex flex-wrap gap-3">
            <Botao variante={acao === 'cancelar' ? 'perigoCheio' : 'primario'} carregando={processando} onClick={executar}>
              {acao === 'cancelar' ? 'Cancelar entrega' : 'Salvar novo horário'}
            </Botao>
            <Botao variante="secundario" onClick={() => setAcao(null)}>Voltar</Botao>
          </div>
        </div>
      </Dialogo>
    </div>
  );
}
