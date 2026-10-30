import { Alerta } from './Alerta.jsx';
import { Botao } from './Botao.jsx';

export function Carregando({ demorando = false, texto = 'Carregando…' }) {
  return (
    <div role="status" className="py-8 text-center">
      <p className="text-lg">{texto}</p>
      {demorando && (
        <p className="mx-auto mt-2 max-w-md text-tinta-suave">
          O servidor estava em repouso e está sendo iniciado. Isso pode levar até 1 minuto.
        </p>
      )}
    </div>
  );
}

export function ErroCarregamento({ erro, aoTentarDeNovo }) {
  return (
    <Alerta
      tipo="erro"
      titulo="Não foi possível carregar as informações."
      acao={aoTentarDeNovo && <Botao variante="secundario" onClick={aoTentarDeNovo}>Tentar de novo</Botao>}
    >
      {erro?.message}
    </Alerta>
  );
}

export function Vazio({ titulo, children, acao }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-linha px-6 py-10 text-center">
      <p className="text-lg font-bold">{titulo}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-tinta-suave">{children}</div>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
