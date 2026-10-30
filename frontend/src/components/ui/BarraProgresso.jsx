import { estiloUrgencia } from '../../utils/urgencia.js';

export function BarraProgresso({ valor, nivel, rotulo, alta = false }) {
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={rotulo}
      className={`w-full overflow-hidden rounded-full bg-nevoa ring-1 ring-inset ring-linha ${alta ? 'h-4' : 'h-3'}`}
    >
      <div className={`h-full rounded-full ${estiloUrgencia(nivel).barra}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
