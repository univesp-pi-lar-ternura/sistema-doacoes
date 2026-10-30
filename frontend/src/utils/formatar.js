export const FUSO = 'America/Sao_Paulo';
export const DESLOCAMENTO_SP = '-03:00';

const fmtNumero = new Intl.NumberFormat('pt-BR');
const fmtPct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function formatarNumero(n) {
  return fmtNumero.format(n ?? 0);
}

export function formatarPercentual(n) {
  return `${fmtPct.format(n ?? 0)}%`;
}

export function paraInstante(valor) {
  if (valor instanceof Date) return valor;
  if (typeof valor === 'string' && /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(valor)) {
    return new Date(`${valor}${DESLOCAMENTO_SP}`);
  }
  return new Date(valor);
}

export function formatarData(iso, opcoes = {}) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long', ...opcoes,
  }).format(paraInstante(iso));
}

export function formatarDataCurta(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(paraInstante(iso));
}

export function formatarHora(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, hour: '2-digit', minute: '2-digit',
  }).format(paraInstante(iso));
}

export function formatarDataHora(iso) {
  if (!iso) return '';
  return `${formatarDataCurta(iso)} às ${formatarHora(iso)}`;
}

export function partesSP(data = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(data);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return { ano: p.year, mes: p.month, dia: p.day, hora: p.hour, minuto: p.minute, segundo: p.second };
}

export function hojeSP() {
  const p = partesSP();
  return `${p.ano}-${p.mes}-${p.dia}`;
}

export function diaSP(deslocamentoDias = 0) {
  const p = partesSP(new Date(Date.now() + deslocamentoDias * 86400000));
  return `${p.ano}-${p.mes}-${p.dia}`;
}

export function diasDeAtraso(dataHoraLocal, agora = new Date()) {
  if (!dataHoraLocal || paraInstante(dataHoraLocal) > agora) return null;
  const meiaNoite = (ano, mes, dia) => Date.UTC(Number(ano), Number(mes) - 1, Number(dia));
  const [ano, mes, dia] = dataHoraLocal.slice(0, 10).split('-');
  const hoje = partesSP(agora);
  return Math.round((meiaNoite(hoje.ano, hoje.mes, hoje.dia) - meiaNoite(ano, mes, dia)) / 86400000);
}

/** 'YYYY-MM' do mês atual em São Paulo. */
export function mesAtualSP() {
  const p = partesSP();
  return `${p.ano}-${p.mes}`;
}

/** Junta data 'YYYY-MM-DD' e hora 'HH:MM' no formato ISO com fuso exigido pela API. */
export function paraIsoComFuso(data, hora) {
  return `${data}T${hora}:00${DESLOCAMENTO_SP}`;
}

export function primeiroNome(nome = '') {
  return nome.trim().split(/\s+/)[0] ?? '';
}
