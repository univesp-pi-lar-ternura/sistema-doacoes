import { estiloUrgencia } from '../../utils/urgencia.js';

export function SeloUrgencia({ nivel, nome }) {
  const estilo = estiloUrgencia(nivel);
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-bold ${estilo.selo}`}>
      {nome ?? estilo.rotulo}
    </span>
  );
}
