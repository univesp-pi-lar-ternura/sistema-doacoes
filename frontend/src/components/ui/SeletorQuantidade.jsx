import { ESTILO_CAMPO_BASE } from './Campo.jsx';

export function SeletorQuantidade({ id, valor, aoMudar, min = 1, max = 9999, rotulo, unidade, erro }) {
  const definir = (n) => aoMudar(Math.max(min, Math.min(max, n)));
  const botao = 'min-h-11 min-w-11 rounded-lg border-2 border-linha-forte bg-papel text-xl font-bold text-tinta hover:bg-nevoa disabled:opacity-40';
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={botao} onClick={() => definir((Number(valor) || min) - 1)}
        disabled={Number(valor) <= min} aria-label={`Diminuir ${rotulo}`}>−</button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={valor}
        onChange={(e) => aoMudar(e.target.value === '' ? '' : Number(e.target.value))}
        aria-label={rotulo}
        aria-invalid={erro ? true : undefined}
        className={`${ESTILO_CAMPO_BASE} w-24 text-center ${erro ? 'border-erro' : 'border-linha-forte'}`}
      />
      <button type="button" className={botao} onClick={() => definir((Number(valor) || 0) + 1)}
        disabled={Number(valor) >= max} aria-label={`Aumentar ${rotulo}`}>+</button>
      {unidade && <span className="text-tinta-suave">{unidade}</span>}
    </div>
  );
}
