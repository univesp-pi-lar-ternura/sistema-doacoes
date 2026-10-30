export const URL_API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
export const USAR_MOCK = import.meta.env.VITE_USAR_MOCK === 'true';

// Para considerar o tempo de resposta do servidor, o tempo de espera é aumentado.
const TIMEOUT_MS = 70000;
const CHAVE_TOKEN = 'lar-ternura:token';

export class ErroApi extends Error {
  constructor({ status = 0, codigo = 'ERRO_INTERNO', mensagem, detalhes = [], requestId = null }) {
    super(mensagem || 'Algo deu errado. Tente de novo.');
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes ?? [];
    this.requestId = requestId;
  }

  get falhaDeRede() {
    return this.status === 0;
  }

  get errosPorCampo() {
    return Object.fromEntries(this.detalhes.map((d) => [d.campo, d.mensagem]));
  }
}

export const sessao = {
  ler() {
    try { return localStorage.getItem(CHAVE_TOKEN); } catch { return null; }
  },
  salvar(token) {
    try { localStorage.setItem(CHAVE_TOKEN, token); } catch { /* navegador sem storage: sessão dura até recarregar */ }
  },
  apagar() {
    try { localStorage.removeItem(CHAVE_TOKEN); } catch { /* nada a fazer */ }
  },
};

let aoPerderSessao = () => {};
export function registrarAoPerderSessao(fn) {
  aoPerderSessao = fn;
}

function montarQuery(params) {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '') continue;
    q.set(chave, Array.isArray(valor) ? valor.join(',') : String(valor));
  }
  const texto = q.toString();
  return texto ? `?${texto}` : '';
}

async function enviarParaMock(metodo, caminho, { corpo, params, token, cabecalhos }) {
  const { tratarRequisicao } = await import('./mock/servidor.js');
  return tratarRequisicao({ metodo, caminho, corpo, params, token, cabecalhos });
}

async function enviarParaApi(metodo, caminho, { corpo, params, token, cabecalhos }) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(`${URL_API}${caminho}${montarQuery(params)}`, {
      method: metodo,
      headers: {
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...cabecalhos,
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    });
    const texto = await resposta.text();
    let json = null;
    try { json = texto ? JSON.parse(texto) : null; } catch { json = null; }
    return { status: resposta.status, corpo: json };
  } catch (erro) {
    if (erro.name === 'AbortError') {
      throw new ErroApi({
        codigo: 'TEMPO_ESGOTADO',
        mensagem: 'O servidor demorou demais para responder. Tente de novo em instantes.',
      });
    }
    throw new ErroApi({
      codigo: 'SEM_CONEXAO',
      mensagem: 'Não foi possível falar com o servidor. Confira sua internet e tente de novo.',
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Faz uma requisição e devolve { status, dados }, ou lança ErroApi.
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} metodo
 * @param {string} caminho  ex.: '/necessidades'
 * @param {{ corpo?: object, params?: object, autenticado?: boolean,
 *           tokenAgendamento?: string, cabecalhos?: object }} opcoes
 *   autenticado: envia o token da sessão da ONG.
 *   tokenAgendamento: envia o código privado de um agendamento (rotas do doador).
 */
export async function requisitarCompleto(metodo, caminho, {
  corpo, params, autenticado = false, tokenAgendamento, cabecalhos = {},
} = {}) {
  const token = tokenAgendamento ?? (autenticado ? sessao.ler() : null);
  const enviar = USAR_MOCK ? enviarParaMock : enviarParaApi;
  const { status, corpo: resposta } = await enviar(metodo, caminho, { corpo, params, token, cabecalhos });

  if (status >= 200 && status < 300) return { status, dados: resposta };

  const erro = new ErroApi({
    status,
    codigo: resposta?.erro?.codigo,
    mensagem: resposta?.erro?.mensagem,
    detalhes: resposta?.erro?.detalhes,
    requestId: resposta?.request_id,
  });

  if (status === 401 && autenticado && !tokenAgendamento) {
    sessao.apagar();
    aoPerderSessao();
  }
  throw erro;
}

export async function requisitar(metodo, caminho, opcoes) {
  return (await requisitarCompleto(metodo, caminho, opcoes)).dados;
}
