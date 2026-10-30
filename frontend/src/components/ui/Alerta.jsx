const TIPOS = {
  info: 'bg-lar-claro border-lar',
  sucesso: 'bg-baixa-claro border-sucesso',
  erro: 'bg-alta-claro border-erro',
  atencao: 'bg-media-claro border-media',
};

export function Alerta({ tipo = 'info', titulo, children, acao, className = '' }) {
  return (
    <div
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={`rounded-lg border-l-8 px-4 py-3 ${TIPOS[tipo]} ${className}`}
    >
      {titulo && <p className="font-bold">{titulo}</p>}
      {children && <div className={titulo ? 'mt-1' : ''}>{children}</div>}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  );
}
