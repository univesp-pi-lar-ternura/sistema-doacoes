import { useDoacao } from '../../contexts/DoacaoContext.jsx';
import { BotaoLink } from '../ui/Botao.jsx';
import { formatarNumero } from '../../utils/formatar.js';

export function PainelDoacao() {
  const { itens, remover } = useDoacao();

  return (
    <section aria-labelledby="titulo-minha-doacao" className="rounded-xl border-2 border-lar bg-papel p-5">
      <h2 id="titulo-minha-doacao" className="text-xl font-bold">Sua doação</h2>
      {itens.length === 0 ? (
        <p className="mt-2 text-tinta-suave">
          Escolha nos cartões o que você pode levar. Os itens aparecem aqui.
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-linha">
            {itens.map((i) => (
              <li key={i.id_item} className="flex items-start justify-between gap-3 py-2">
                <span>
                  <span className="block">{i.nome_item}</span>
                  <span className="font-bold">{formatarNumero(i.quantidade)} {i.unidade_medida}</span>
                </span>
                <button type="button" onClick={() => remover(i.id_item)}
                  className="min-h-11 shrink-0 rounded-md px-2 text-lar underline underline-offset-2"
                  aria-label={`Retirar ${i.nome_item}`}>
                  Retirar
                </button>
              </li>
            ))}
          </ul>
          <BotaoLink to="/agendar" largo className="mt-4">Agendar entrega</BotaoLink>
        </>
      )}
    </section>
  );
}

export function BarraDoacaoMovel() {
  const { total } = useDoacao();
  if (total === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-lar bg-papel px-4 py-3 shadow-[0_-4px_12px_rgb(34_48_74/0.12)] lg:hidden">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <p className="font-bold">{total} {total === 1 ? 'item escolhido' : 'itens escolhidos'}</p>
        <BotaoLink to="/agendar">Agendar entrega</BotaoLink>
      </div>
    </div>
  );
}
