import { useEffect, useId, useRef } from 'react';

export function Dialogo({ aberto, aoFechar, titulo, descricao, children, largura = 'max-w-lg' }) {
  const ref = useRef(null);
  const idTitulo = useId();
  const idDescricao = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (aberto && !el.open) el.showModal();
    if (!aberto && el.open) el.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idDescricao : undefined}
      onClose={aoFechar}
      onCancel={(e) => { e.preventDefault(); aoFechar(); }}
      className={`m-auto w-[calc(100%-2rem)] ${largura} rounded-xl bg-papel p-0 text-tinta shadow-2xl`}
    >
      {aberto && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-linha px-5 py-4">
            <div>
              <h2 id={idTitulo} className="text-xl font-bold">{titulo}</h2>
              {descricao && <p id={idDescricao} className="mt-1 text-tinta-suave">{descricao}</p>}
            </div>
            <button
              type="button"
              onClick={aoFechar}
              className="min-h-11 min-w-11 rounded-lg text-2xl leading-none text-tinta-suave hover:bg-nevoa"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
