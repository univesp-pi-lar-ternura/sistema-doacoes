import { Link } from 'react-router-dom';
import { listarNecessidades } from '../../api/index.js';
import { useCarregar } from '../../hooks/useCarregar.js';
import { useTitulo } from '../../hooks/useTitulo.js';
import { BotaoLink } from '../../components/ui/Botao.jsx';
import { SeloUrgencia } from '../../components/ui/SeloUrgencia.jsx';
import { CONTATO, LOCAL_ENTREGA, linkWhatsApp } from '../../config.js';
import { formatarNumero } from '../../utils/formatar.js';
import { estiloUrgencia } from '../../utils/urgencia.js';

const PASSOS = [
  { titulo: 'Escolha', texto: 'Veja o que o Lar mais precisa agora e quanto falta de cada item.' },
  { titulo: 'Agende', texto: 'Diga o que vai levar e escolha o dia e o horário. Não precisa criar conta.' },
  { titulo: 'Entregue', texto: 'Leve os itens ao Lar e informe o código da sua entrega na portaria.' },
];

export default function PaginaInicial() {
  useTitulo('Doe para o Lar Ternura');
  const urgentes = useCarregar(listarNecessidades, []);
  const destaque = (urgentes.dados?.itens ?? []).filter((n) => !n.meta_atingida).slice(0, 3);

  return (
    <>
      <section aria-labelledby="titulo-inicio" className="bg-marca-amarelo text-marca-escuro">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 md:grid-cols-[minmax(0,1fr)_16rem] md:py-14">
          <div>
            <h1 id="titulo-inicio" className="text-4xl font-extrabold leading-tight sm:text-5xl">
              Doe o que o Lar Ternura mais precisa
            </h1>
            <p className="mt-4 max-w-2xl text-xl">
              O Lar Ternura acolhe jovens e adultos com deficiência na Zona Oeste de São Paulo.
              Veja a lista de necessidades, escolha o que pode levar e agende a entrega.
            </p>
            <BotaoLink to="/doar" className="mt-6 px-8 py-3 text-xl">Necessidades do Lar</BotaoLink>
          </div>
          <img src="/logo-lar-ternura.png" alt="" width="256" height="256" className="mx-auto hidden size-64 md:block" />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        <section aria-labelledby="titulo-como" className="py-10">
          <h2 id="titulo-como" className="text-3xl font-extrabold">Como funciona</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="flex gap-4 rounded-xl border-2 border-linha bg-papel p-5">
                <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-marca-laranja font-titulo text-2xl font-extrabold text-marca-escuro">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-xl font-bold">{p.titulo}</span>
                  <span className="mt-1 block text-tinta-suave">{p.texto}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {destaque.length > 0 && (
          <section aria-labelledby="titulo-agora" className="rounded-xl bg-nevoa p-6">
            <h2 id="titulo-agora" className="text-2xl font-extrabold">O que mais falta agora</h2>
            <ul className="mt-4 grid gap-3 md:grid-cols-3">
              {destaque.map((n) => (
                <li key={n.id_necessidade} className="flex flex-col gap-2 rounded-lg border border-linha bg-papel p-4">
                  <span className="self-start"><SeloUrgencia nivel={n.urgencia.nivel} nome={estiloUrgencia(n.urgencia.nivel).rotulo} /></span>
                  <span className="font-bold">{n.nome_item}</span>
                  <span className="text-tinta-suave">Faltam {formatarNumero(n.quantidade_faltante)} {n.unidade_medida}</span>
                </li>
              ))}
            </ul>
            <Link to="/doar" className="mt-4 inline-flex min-h-11 items-center font-bold text-lar underline underline-offset-4">
              Ver a lista completa
            </Link>
          </section>
        )}

        <section aria-labelledby="titulo-onde" className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border-2 border-linha p-6">
            <h2 id="titulo-onde" className="text-2xl font-extrabold">Onde entregar</h2>
            <p className="mt-2 text-lg">{LOCAL_ENTREGA.endereco}</p>
            <p className="mt-2 text-tinta-suave">O Lar não busca doações em casa: a entrega é feita no local, no horário que você agendar.</p>
            <a href={LOCAL_ENTREGA.mapa} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center font-bold text-lar underline underline-offset-4">
              Ver no mapa<span className="so-leitor"> (abre em nova aba)</span>
            </a>
          </div>
          <div className="rounded-xl border-2 border-linha p-6">
            <h2 className="text-2xl font-extrabold">Dúvidas?</h2>
            <p className="mt-2">Fale com a equipe do Lar pelo WhatsApp {CONTATO.whatsapp} ou pelo telefone {CONTATO.telefone}.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={linkWhatsApp(CONTATO.whatsapp, 'Olá! Tenho uma dúvida sobre doações para o Lar Ternura.')}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-lg border-2 border-lar bg-lar px-5 font-bold text-white no-underline hover:bg-lar-escuro">
                Chamar no WhatsApp<span className="so-leitor"> (abre em nova aba)</span>
              </a>
              <a href={CONTATO.site} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-lg border-2 border-lar px-5 font-bold text-lar no-underline hover:bg-lar-claro">
                Conhecer o Lar<span className="so-leitor"> (site oficial, abre em nova aba)</span>
              </a>
            </div>
            <p className="mt-4 text-sm text-tinta-suave">
              Já agendou? Abra o link que apareceu na confirmação para consultar, mudar ou cancelar a entrega.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
