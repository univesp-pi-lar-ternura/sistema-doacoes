import { useEffect, useState } from 'react';
import { consultarDisponibilidade, consultarFeriados } from '../../api/index.js';
import { Campo } from './Campo.jsx';
import { formatarData, hojeSP } from '../../utils/formatar.js';

const chip = 'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 border-linha-forte px-4 py-1 font-bold '
  + 'has-[:checked]:border-lar has-[:checked]:bg-lar has-[:checked]:text-white '
  + 'has-[:disabled]:cursor-not-allowed has-[:disabled]:border-linha has-[:disabled]:text-tinta-suave has-[:disabled]:line-through '
  + 'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lar';

/**
 * Aviso de feriado nacional (BrasilAPI, via backend). Só informa: a decisão do grupo é não
 * bloquear feriados, porque a ONG pode receber doações nesses dias.
 * A região aria-live fica sempre na página, para leitores de tela anunciarem cada mudança.
 */
function AvisoFeriado({ data }) {
  const [estado, setEstado] = useState({ data: null, feriado: null, indisponivel: false });

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? '')) { setEstado({ data: null, feriado: null, indisponivel: false }); return undefined; }
    let ativo = true;
    consultarFeriados(Number(data.slice(0, 4))).then((r) => {
      if (!ativo) return;
      setEstado({ data, feriado: r.disponivel ? r.feriados.find((f) => f.data === data) ?? null : null, indisponivel: !r.disponivel });
    });
    return () => { ativo = false; };
  }, [data]);

  const atual = estado.data === data;
  return (
    <div aria-live="polite">
      {atual && estado.feriado && (
        <div className="rounded-lg border-l-8 border-media bg-media-claro px-4 py-3">
          <p><strong>Feriado nacional: {estado.feriado.nome}.</strong> Confira se o Lar Ternura recebe doações nesse dia. O agendamento continua permitido.</p>
          <p className="mt-1 text-sm text-tinta-suave">Fonte: BrasilAPI.</p>
        </div>
      )}
      {atual && estado.indisponivel && (
        <p className="text-sm text-tinta-suave">Não foi possível consultar o calendário de feriados agora. Os horários abaixo continuam valendo.</p>
      )}
    </div>
  );
}

export function EscolherHorario({ data, horario, aoMudar, erroData, erroHorario, idData = 'data', idHorario = 'hora' }) {
  const [estado, setEstado] = useState({ carregando: false, horarios: null, erro: null });

  useEffect(() => {
    if (!data) { setEstado({ carregando: false, horarios: null, erro: null }); return undefined; }
    let ativo = true;
    setEstado({ carregando: true, horarios: null, erro: null });
    consultarDisponibilidade(data)
      .then((horarios) => ativo && setEstado({ carregando: false, horarios, erro: null }))
      .catch((erro) => ativo && setEstado({ carregando: false, horarios: null, erro }));
    return () => { ativo = false; };
  }, [data]);

  const { carregando, horarios, erro } = estado;
  const livres = (horarios ?? []).filter((h) => h.vagas > 0);

  return (
    <div className="flex flex-col gap-4">
      <Campo id={idData} rotulo="Dia da entrega" obrigatorio erro={erroData}
        dica={data && !erroData ? formatarData(`${data}T12:00:00`) : undefined}>
        <input type="date" min={hojeSP()} value={data}
          onChange={(e) => aoMudar({ data: e.target.value, horario: '' })} className="sm:max-w-xs" />
      </Campo>

      <AvisoFeriado data={data} />

      {data && (
        <fieldset id={idHorario} tabIndex={-1} aria-describedby={erroHorario ? `${idHorario}-erro` : undefined}>
          <legend className="mb-2 font-bold">Horário <span aria-hidden="true" className="text-erro">*</span></legend>
          {carregando && <p role="status">Consultando horários livres…</p>}
          {erro && <p role="alert" className="font-bold text-erro">Não foi possível consultar os horários. {erro.message}</p>}
          {horarios && livres.length === 0 && (
            <p role="status" className="text-tinta-suave">Não há horários livres neste dia. Escolha outro dia.</p>
          )}
          {horarios && livres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {horarios.map((h) => (
                <label key={h.horario} className={chip}>
                  <input type="radio" name={`${idHorario}-opcao`} className="so-leitor" value={h.horario}
                    checked={horario === h.horario} disabled={h.vagas === 0}
                    onChange={() => aoMudar({ data, horario: h.horario })} />
                  {h.horario}
                  {h.vagas === 0 && <span className="so-leitor"> (lotado)</span>}
                </label>
              ))}
            </div>
          )}
          {erroHorario && <p id={`${idHorario}-erro`} className="mt-1 text-sm font-bold text-erro">{erroHorario}</p>}
        </fieldset>
      )}
    </div>
  );
}
