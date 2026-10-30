import { useEffect, useRef } from 'react';

export function ResumoErros({ erros, rotulos = {}, gatilho }) {
  const ref = useRef(null);
  const lista = Object.entries(erros).filter(([, msg]) => msg);

  useEffect(() => {
    if (lista.length) ref.current?.focus();
    // gatilho muda a cada tentativa de envio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatilho]);

  if (!lista.length) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="rounded-lg border-l-8 border-erro bg-alta-claro px-4 py-3">
      <p className="font-bold">Confira {lista.length === 1 ? 'o campo abaixo' : `os ${lista.length} campos abaixo`}:</p>
      <ul className="mt-2 list-disc pl-6">
        {lista.map(([campo, msg]) => (
          <li key={campo}>
            <a href={`#${campo}`} className="text-erro underline underline-offset-2">
              {rotulos[campo] ? `${rotulos[campo]}: ` : ''}{msg}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
