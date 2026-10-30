import { ApiClient, BookingAttempt, bookingBody, saoPauloToday, validDate } from './cliente-agendamento.mjs';
const api = new ApiClient('');
const el = id => document.getElementById(id);
let itens = [], versaoData = 0, cancelamento, tentativa, enviando = false;
el('data').min = saoPauloToday();
el('data').max = '2099-12-31';

function erro(mensagem) { el('erro').textContent = mensagem;el('erro').hidden = false;el('erro').focus(); }
function atualizarEnvio() {
  el('enviar').disabled = enviando || (!tentativa?.uncertain && (!el('horario').value || !el('item').value));
}
async function carregarItens() {
  el('recarregar').hidden = true;el('campos').disabled = true;el('enviar').disabled = true;
  try {
    itens = [];
    for (let offset = 0; ; offset += 100) {
      const pagina = await api.listItems(offset);
      itens.push(...pagina.filter(i => !i.meta_atingida));
      if (pagina.length < 100) break;
    }
    el('item').replaceChildren(new Option('Selecione um item', ''));
    for (const item of itens) el('item').add(new Option(`${item.nome_item} — ${item.unidade_medida}`, String(item.id_item)));
    el('campos').disabled = !itens.length;
    el('carregamento').textContent = itens.length ? 'Necessidades atualizadas. Preencha sua entrega.' : 'Nenhuma necessidade disponível para agendamento no momento.';
  } catch { el('carregamento').textContent = 'Não foi possível carregar as necessidades.';el('recarregar').hidden = false; }
}

async function atualizarData() {
  const versao = ++versaoData, data = el('data').value;
  cancelamento?.abort();cancelamento = new AbortController();
  el('horario').replaceChildren(new Option('Consultando horários…', ''));el('horario').disabled = true;
  el('reconsultar').hidden = true;el('vagas').textContent = '';atualizarEnvio();
  if (!validDate(data) || data < saoPauloToday()) {
    el('horario').replaceChildren(new Option('Escolha uma data válida', ''));
    el('calendario').textContent = 'Escolha uma data válida a partir de hoje.';return;
  }
  el('calendario').textContent = 'Consultando informação de calendário…';
  // Independentes: uma falha ou demora no calendário não impede consultar vagas.
  api.request('/calendario/feriados/' + data.slice(0, 4), { signal: cancelamento.signal }).then(resultado => {
    if (versao !== versaoData) return;
    if (resultado.status !== 'disponivel') throw new Error('Calendário indisponível');
    const datas = resultado.feriados.filter(item => item.data === data);
    el('calendario').textContent = datas.length
      ? `BrasilAPI informa: ${datas.map(item => item.nome).join(', ')}. Isso não indica fechamento da ONG; confira os horários disponíveis.`
      : 'A BrasilAPI não lista uma data especial para esse dia. O funcionamento da ONG depende dos horários disponíveis.';
  }).catch(() => {
    if (versao === versaoData) el('calendario').textContent = 'Informação de calendário indisponível no momento. Você pode continuar com os horários disponíveis.';
  });
  try {
    const r = await api.availability(data, cancelamento.signal);
    if (versao !== versaoData) return;
    const horarios = r.horarios.filter(h => h.vagas > 0);
    el('horario').replaceChildren(new Option(horarios.length ? 'Selecione um horário' : 'Sem vagas nessa data', ''));
    for (const h of horarios) el('horario').add(new Option(`${h.horario} (${h.vagas} vagas)`, h.horario));
    el('horario').disabled = !horarios.length;
    el('vagas').textContent = horarios.length ? 'Horários de São Paulo. A vaga será confirmada ao enviar.' : 'Escolha outra data para consultar vagas.';
  } catch {
    if (versao !== versaoData) return;
    el('horario').replaceChildren(new Option('Horários indisponíveis', ''));
    el('vagas').textContent = 'Não foi possível consultar os horários. Tente novamente.';el('reconsultar').hidden = false;
  }
  atualizarEnvio();
}

el('recarregar').addEventListener('click', carregarItens);
el('reconsultar').addEventListener('click', atualizarData);
el('data').addEventListener('change', atualizarData);
el('agendamento').addEventListener('input', () => { if (!tentativa?.uncertain) tentativa = null;atualizarEnvio(); });
el('agendamento').addEventListener('change', atualizarEnvio);
el('agendamento').addEventListener('submit', async event => {
  event.preventDefault();if (enviando) return;
  el('erro').hidden = true;
  try {
    if (!tentativa?.uncertain) {
      const item = itens.find(i => String(i.id_item) === el('item').value);
      if (!item) throw new Error('Selecione uma necessidade disponível.');
      const body = bookingBody({ nome: el('nome').value, email: el('email').value, telefone: el('telefone').value, tipo_doador: el('tipo').value },
        el('data').value, el('horario').value, [{ id_item: item.id_item, id_necessidade: item.id_necessidade, quantidade_doada: Number(el('quantidade').value) }]);
      tentativa = new BookingAttempt(body);
    }
    enviando = true;el('campos').disabled = true;el('enviar').textContent = 'Confirmando…';atualizarEnvio();
    const r = await tentativa.send(api);
    el('agendamento').hidden = true;el('sucesso').hidden = false;
    el('resumo').textContent = `Entrega nº ${r.agendamento.id_agendamento}, em ${tentativa.body.data.split('-').reverse().join('/')} às ${tentativa.body.horario} (São Paulo). Situação: ${r.agendamento.status_agendamento}.`;
    el('codigo').value = r.token_acesso;el('titulo-sucesso').focus();
  } catch (e) {
    erro(tentativa?.uncertain ? 'Ainda não foi possível confirmar o resultado. Tente novamente para consultar ou concluir o mesmo pedido, sem duplicá-lo.' : e.message);
    if (!tentativa?.uncertain) { tentativa = null;el('campos').disabled = false; }
  } finally {
    enviando = false;el('enviar').textContent = tentativa?.uncertain ? 'Tentar novamente o mesmo pedido' : 'Confirmar agendamento';atualizarEnvio();
  }
});
el('mostrar-codigo').addEventListener('click', () => {
  const mostrar = el('codigo').type === 'password';el('codigo').type = mostrar ? 'text' : 'password';
  el('mostrar-codigo').textContent = mostrar ? 'Ocultar código' : 'Mostrar código';el('mostrar-codigo').setAttribute('aria-pressed', String(mostrar));
});
carregarItens();
