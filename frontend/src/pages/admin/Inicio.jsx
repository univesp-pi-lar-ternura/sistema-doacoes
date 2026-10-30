import { Link } from 'react-router-dom';
import { obterResumo } from '../../api/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useCarregar } from '../../hooks/useCarregar.js';
import { useTitulo } from '../../hooks/useTitulo.js';
import { Carregando, ErroCarregamento } from '../../components/ui/Estados.jsx';
import { primeiroNome } from '../../utils/formatar.js';

function Atalho({ para, titulo, detalhe, destaque = false }) {
  return (
    <Link to={para}
      className={`flex min-h-32 flex-col justify-between rounded-xl border-2 p-5 no-underline transition-colors ${
        destaque ? 'border-lar bg-lar text-white hover:bg-lar-escuro' : 'border-linha bg-papel hover:border-lar'}`}>
      <span className="text-xl font-bold">{titulo}</span>
      <span className={destaque ? 'text-white' : 'text-tinta-suave'}>{detalhe}</span>
    </Link>
  );
}

export default function Inicio() {
  useTitulo('Painel');
  const { usuario } = useAuth();
  const resumo = useCarregar(obterResumo, []);
  const r = resumo.dados;

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  return (
    <div>
      <h1 className="text-3xl font-bold">Olá, {primeiroNome(usuario.nome)}</h1>
      <p className="mt-1 text-tinta-suave">O que você quer fazer agora?</p>

      {resumo.carregando && <Carregando demorando={resumo.demorando} />}
      {resumo.erro && <div className="mt-6"><ErroCarregamento erro={resumo.erro} aoTentarDeNovo={resumo.recarregar} /></div>}

      {r && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Atalho para="/admin/agendamentos" destaque
            titulo="Doações de hoje"
            detalhe={r.agendamentos_hoje
              ? `${plural(r.agendamentos_hoje, 'entrega agendada', 'entregas agendadas')} para hoje`
              : 'Nenhuma entrega agendada para hoje'} />
          <Atalho para="/admin/agendamentos?periodo=abertas"
            titulo="Doações em aberto"
            detalhe={`${plural(r.agendamentos_abertos, 'em aberto', 'em aberto')}${r.agendamentos_atrasados
              ? `, ${plural(r.agendamentos_atrasados, 'atrasada', 'atrasadas')}` : ''}`} />
          <Atalho para="/admin/registrar"
            titulo="Registrar doação que chegou"
            detalhe="Para doações sem agendamento" />
          <Atalho para="/admin/necessidades"
            titulo="Necessidades"
            detalhe={`${plural(r.necessidades_abertas, 'aberta', 'abertas')}${r.necessidades_criticas_abaixo_30
              ? `, ${plural(r.necessidades_criticas_abaixo_30, 'urgente abaixo de 30%', 'urgentes abaixo de 30%')}` : ''}`} />
        </div>
      )}

      {r && (
        <section aria-labelledby="titulo-numeros" className="mt-8 rounded-xl border border-linha bg-papel p-5">
          <h2 id="titulo-numeros" className="text-xl font-bold">Em números</h2>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-tinta-suave">Entregas agendadas nos próximos 7 dias</dt>
              <dd className="text-3xl font-bold">{r.agendamentos_proximos_7_dias}</dd>
            </div>
            <div>
              <dt className="text-tinta-suave">Doações recebidas neste mês</dt>
              <dd className="text-3xl font-bold">{r.recebimentos_mes.entregas}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}
