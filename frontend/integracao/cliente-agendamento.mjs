export const MAX_QUANTITY = 2147483647;
export function saoPauloToday(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const values = Object.fromEntries(p.map(v => [v.type, v.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
export function validDate(value) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function quantity(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_QUANTITY ? n : null;
}
export function validateDonor(values) {
  const errors = {};
  const nome = (values.nome || '').trim(), email = (values.email || '').trim().toLowerCase();
  const telefone = (values.telefone || '').trim(), tipo_doador = values.tipo_doador || 'PF';
  if (nome.length < 2 || nome.length > 100) errors.nome = 'Informe seu nome, entre 2 e 100 caracteres.';
  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Informe um e-mail válido.';
  if (telefone.length > 20 || !/^\+?[\d\s().-]{8,20}$/.test(telefone) || telefone.replace(/\D/g, '').length < 8) errors.telefone = 'Informe um telefone válido, com DDD.';
  if (!['PF', 'PJ'].includes(tipo_doador)) errors.tipo_doador = 'Escolha pessoa física ou jurídica.';
  return { errors, doador: { nome, email, telefone, tipo_doador } };
}
export function normalizeSelection(items) {
  if (!Array.isArray(items) || items.length > 100) throw new Error('Selecione até 100 itens.');
  const seen = new Set();
  return items.map(item => {
    if (!Number.isInteger(item.id_item) || item.id_item < 1 || item.id_item > MAX_QUANTITY || seen.has(item.id_item) || quantity(item.quantidade_doada) === null) throw new Error('Seleção inválida. Confira os itens e as quantidades.');
    seen.add(item.id_item);
    if(typeof item.id_necessidade !== 'string' || !/^[1-9]\d{0,18}$/.test(item.id_necessidade) || BigInt(item.id_necessidade)>9223372036854775807n) throw new Error('Atualize a seleção para identificar a meta atual.');
    return { id_item: item.id_item, id_necessidade: item.id_necessidade, quantidade_doada: quantity(item.quantidade_doada) };
  }).sort((a, b) => a.id_item - b.id_item);
}
export function bookingBody(doador, data, horario, items) {
  const checked = validateDonor(doador);
  if (Object.keys(checked.errors).length) throw new Error('Confira seus dados de contato.');
  if (!validDate(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario || '')) throw new Error('Escolha uma data e um horário válidos.');
  const itens = normalizeSelection(items);
  if (!itens.length) throw new Error('Selecione pelo menos um item para doar.');
  return { doador: checked.doador, data, horario, itens };
}
export class ApiError extends Error {
  constructor(message, status = 0, code = 'REDE', retryAfter = 0) { super(message); this.status = status; this.code = code; this.retryAfter = retryAfter; }
  get uncertain() { return this.status === 0 || this.status >= 500; }
}
export class ApiClient {
  constructor(base, fetcher = globalThis.fetch.bind(globalThis), timeout = 15000) {
    this.base = base.replace(/\/$/, ''); this.fetcher = fetcher; this.timeout = timeout;
  }
  async request(path, { method = 'GET', body, key, signal } = {}) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(cancel, this.timeout);
    try {
      const response = await this.fetcher(this.base + path, { method, signal: controller.signal, cache: 'no-store',
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(result?.erro?.mensagem || 'Não foi possível concluir. Tente novamente.', response.status, result?.erro?.codigo || 'API', Math.max(0, Number(response.headers.get('Retry-After')) || 0));
      if (result === null) throw new ApiError('Não foi possível confirmar a resposta do servidor.');
      return result;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('A conexão foi interrompida. Tente novamente.');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }
  listItems(offset = 0) { return this.request(`/itens?limit=100&offset=${offset}`); }
  availability(day, signal) { return this.request(`/disponibilidade?data=${encodeURIComponent(day)}`, { signal }); }
}
export class BookingAttempt {
  constructor(body, key = globalThis.crypto.randomUUID()) {
    this.body = JSON.parse(JSON.stringify(body)); this.key = key; this.uncertain = false; this.pending = null;
  }
  send(client) {
    if (this.pending) return this.pending;
    this.pending = this.perform(client).finally(() => { this.pending = null; });
    return this.pending;
  }
  async perform(client) {
    try {
      const response = await client.request('/agendamentos', { method: 'POST', body: this.body, key: this.key });
      const booking = response?.agendamento;
      if (!Number.isInteger(booking?.id_agendamento) || booking.id_agendamento < 1 ||
          !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(booking.data_hora_agendada || '') ||
          !Array.isArray(booking.itens) || !booking.itens.length ||
          booking.itens.some(item => typeof item.nome_item !== 'string' || typeof item.unidade_medida !== 'string' || quantity(item.quantidade_doada) === null) ||
          !['Pendente', 'Confirmado', 'Cancelado', 'Concluído'].includes(booking.status_agendamento) ||
          !/^[a-f0-9]{64}$/.test(response?.token_acesso || '')) throw new ApiError('Não foi possível confirmar o resultado do agendamento.');
      this.uncertain = false;
      return response;
    } catch (error) { this.uncertain = error.uncertain ?? true; throw error; }
  }
}
