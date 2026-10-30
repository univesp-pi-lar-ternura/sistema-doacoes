export const ESTILO_URGENCIA = {
  1: { rotulo: 'Urgente', selo: 'bg-alta text-white', barra: 'bg-alta', fundo: 'bg-alta-claro' },
  2: { rotulo: 'Prioridade média', selo: 'bg-media text-media-texto', barra: 'bg-media', fundo: 'bg-media-claro' },
  3: { rotulo: 'Prioridade baixa', selo: 'bg-baixa text-white', barra: 'bg-baixa', fundo: 'bg-baixa-claro' },
};

export function estiloUrgencia(nivel) {
  return ESTILO_URGENCIA[nivel] ?? ESTILO_URGENCIA[3];
}
