import { Link } from 'react-router-dom';

const VARIANTES = {
  primario: 'bg-lar text-white hover:bg-lar-escuro border-2 border-lar hover:border-lar-escuro',
  secundario: 'bg-papel text-lar border-2 border-lar hover:bg-lar-claro',
  perigo: 'bg-papel text-erro border-2 border-erro hover:bg-alta-claro',
  perigoCheio: 'bg-erro text-white border-2 border-erro hover:brightness-90',
  discreto: 'bg-transparent text-lar underline underline-offset-4 hover:text-lar-escuro border-2 border-transparent',
};

// min-h-11 = 44px: área mínima de toque (WCAG 2.5.5).
const BASE = 'inline-flex items-center justify-center gap-2 min-h-11 px-5 py-2 rounded-lg font-bold text-base '
  + 'transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

export function Botao({ variante = 'primario', largo = false, carregando = false, className = '', children, disabled, ...props }) {
  return (
    <button
      type="button"
      className={`${BASE} ${VARIANTES[variante]} ${largo ? 'w-full' : ''} ${className}`}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...props}
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  );
}

export function BotaoLink({ variante = 'primario', largo = false, className = '', ...props }) {
  return <Link className={`${BASE} ${VARIANTES[variante]} ${largo ? 'w-full' : ''} ${className}`} {...props} />;
}
