import { cloneElement, useId } from 'react';

export function Campo({ id: idFixo, rotulo, dica, erro, obrigatorio = false, children, className = '' }) {
  const idGerado = useId();
  const id = idFixo ?? idGerado;
  const idDica = dica ? `${id}-dica` : undefined;
  const idErro = erro ? `${id}-erro` : undefined;
  const descritoPor = [idDica, idErro].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="font-bold">
        {rotulo}
        {obrigatorio && <span aria-hidden="true" className="text-erro"> *</span>}
        {obrigatorio && <span className="so-leitor"> (obrigatório)</span>}
      </label>
      {dica && <p id={idDica} className="text-sm text-tinta-suave">{dica}</p>}
      {cloneElement(children, {
        id,
        'aria-invalid': erro ? true : undefined,
        'aria-describedby': descritoPor,
        required: obrigatorio || undefined,
        className: `${ESTILO_CAMPO} ${erro ? 'border-erro' : 'border-linha-forte'} ${children.props.className ?? ''}`,
      })}
      {erro && <p id={idErro} className="text-sm font-bold text-erro">{erro}</p>}
    </div>
  );
}

export const ESTILO_CAMPO_BASE = 'min-h-11 rounded-lg border-2 bg-papel px-3 py-2 text-base '
  + 'text-tinta placeholder:text-tinta-suave disabled:bg-nevoa';
export const ESTILO_CAMPO = `${ESTILO_CAMPO_BASE} w-full`;
