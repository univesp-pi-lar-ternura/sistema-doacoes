const CHAVE = 'lar-ternura:meus-agendamentos';

export function linkDoAgendamento(id, token) {
  return `${window.location.origin}/meu-agendamento/${id}#${token}`;
}

export function lembrarAgendamento(id, token) {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE) ?? '{}');
    lista[id] = token;
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch { /* sem storage: o link continua funcionando */ }
}

export function tokenLembrado(id) {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? '{}')[id] ?? null; } catch { return null; }
}
