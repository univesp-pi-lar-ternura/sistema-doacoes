import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { criarAgendamento } from '../../api/index.js';
import { useDoacao } from '../../contexts/DoacaoContext.jsx';
import { useTitulo } from '../../hooks/useTitulo.js';
import { Campo } from '../../components/ui/Campo.jsx';
import { Botao, BotaoLink } from '../../components/ui/Botao.jsx';
import { Alerta } from '../../components/ui/Alerta.jsx';
import { ResumoErros } from '../../components/ui/ResumoErros.jsx';
import { SeletorQuantidade } from '../../components/ui/SeletorQuantidade.jsx';
import { EscolherHorario } from '../../components/ui/EscolherHorario.jsx';
import { Vazio } from '../../components/ui/Estados.jsx';
import { hojeSP } from '../../utils/formatar.js';
import { emailValido, telefoneValido, mascararTelefone, quantidadeValida, gerarUuid } from '../../utils/validar.js';
import { lembrarAgendamento } from '../../utils/meusAgendamentos.js';

const ROTULOS = { data: 'Dia da entrega', hora: 'Horário', nome: 'Nome', email: 'E-mail', telefone: 'Telefone', itens: 'Itens', consentimento: 'Uso dos dados' };

export default function Agendar() {
  useTitulo('Agendar entrega');
  const navegar = useNavigate();
  const { itens, definirQuantidade, remover, limpar } = useDoacao();
  const [form, setForm] = useState({ data: '', hora: '', nome: '', email: '', telefone: '', tipo: 'PF', consentimento: false });
  const [erros, setErros] = useState({});
  const [tentativa, setTentativa] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState(null);
  // Idempotency-Key: a mesma chave é reenviada só se a tentativa anterior falhou por rede.
  // Se a API respondeu (mesmo com erro), a próxima tentativa usa uma chave nova.
  const chave = useRef(gerarUuid());

  const mudar = (campo) => (e) => {
    const valor = campo === 'telefone' ? mascararTelefone(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  function validar() {
    const e = {};
    if (!itens.length) e.itens = 'Sua doação está vazia.';
    for (const i of itens) {
      if (!quantidadeValida(i.quantidade)) e[`qtd-agendar-${i.id_item}`] = `Quantidade de ${i.nome_item}: use um número inteiro de 1 a 9999.`;
    }
    if (!form.data) e.data = 'Escolha o dia.';
    else if (form.data < hojeSP()) e.data = 'Escolha um dia a partir de hoje.';
    if (form.data && !form.hora) e.hora = 'Escolha um horário livre.';
    if (form.nome.trim().length < 2) e.nome = 'Informe seu nome.';
    if (!emailValido(form.email)) e.email = 'Informe um e-mail válido, como nome@exemplo.com.';
    if (!telefoneValido(form.telefone)) e.telefone = 'Informe um telefone com DDD.';
    if (!form.consentimento) e.consentimento = 'Marque a caixa para o Lar poder falar com você sobre a entrega.';
    return e;
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErroGeral(null);
    const encontrados = validar();
    setErros(encontrados);
    setTentativa((t) => t + 1);
    if (Object.keys(encontrados).length) return;

    setEnviando(true);
    try {
      const resposta = await criarAgendamento({
        chave: chave.current,
        doador: { nome: form.nome.trim(), email: form.email.trim(), telefone: form.telefone, tipo_doador: form.tipo },
        data: form.data,
        horario: form.hora,
        itens,
      });
      const { agendamento, token_acesso: token } = resposta;
      lembrarAgendamento(agendamento.id_agendamento, token);
      limpar();
      navegar('/agendamento/confirmado', { state: { agendamento, token, nome: form.nome.trim() } });
    } catch (erro) {
      if (!erro.falhaDeRede) chave.current = gerarUuid();
      setErroGeral(erro);
    } finally {
      setEnviando(false);
    }
  }

  if (!itens.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">Agendar entrega</h1>
        <div className="mt-6">
          <Vazio titulo="Sua doação ainda está vazia" acao={<BotaoLink to="/doar">Ver o que o Lar precisa</BotaoLink>}>
            Escolha primeiro os itens que você pode levar.
          </Vazio>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/doar" className="inline-flex min-h-11 items-center font-bold text-lar underline underline-offset-4">
        Voltar para a lista
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Agendar entrega</h1>
      <p className="mt-2 text-lg text-tinta-suave">Confira os itens, escolha quando vai levar e deixe um contato.</p>

      <form onSubmit={enviar} noValidate className="mt-8 flex flex-col gap-10">
        <ResumoErros erros={erros} rotulos={ROTULOS} gatilho={tentativa} />
        {erroGeral && (
          <Alerta tipo="erro" titulo="Não foi possível agendar."
            acao={erroGeral.status === 409 && <BotaoLink to="/doar" variante="secundario">Atualizar a lista de necessidades</BotaoLink>}>
            {erroGeral.message}
            {erroGeral.falhaDeRede && ' Clique de novo em Confirmar: o pedido não será duplicado.'}
          </Alerta>
        )}

        <fieldset id="itens" tabIndex={-1} className="flex flex-col gap-4">
          <legend className="text-xl font-bold">1. O que você vai levar</legend>
          <ul className="divide-y divide-linha rounded-xl border border-linha">
            {itens.map((i) => {
              const idCampo = `qtd-agendar-${i.id_item}`;
              return (
                <li key={i.id_item} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor={idCampo} className="font-bold">{i.nome_item}</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <SeletorQuantidade id={idCampo} valor={i.quantidade} unidade={i.unidade_medida}
                      rotulo={`quantidade de ${i.nome_item}`} erro={erros[idCampo]}
                      aoMudar={(q) => definirQuantidade(i, q)} />
                    <button type="button" onClick={() => remover(i.id_item)}
                      className="min-h-11 rounded-md px-2 text-lar underline underline-offset-2"
                      aria-label={`Retirar ${i.nome_item}`}>Retirar</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-xl font-bold">2. Quando você vai entregar</legend>
          <EscolherHorario data={form.data} horario={form.hora} erroData={erros.data} erroHorario={erros.hora}
            aoMudar={({ data, horario }) => setForm((f) => ({ ...f, data, hora: horario }))} />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-xl font-bold">3. Seus dados</legend>
          <p className="-mt-2 text-tinta-suave">Usados só para o Lar Ternura falar com você sobre esta entrega.</p>
          <Campo id="nome" rotulo="Nome completo ou da empresa" obrigatorio erro={erros.nome}>
            <input type="text" autoComplete="name" value={form.nome} onChange={mudar('nome')} maxLength={100} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="email" rotulo="E-mail" obrigatorio erro={erros.email}>
              <input type="email" autoComplete="email" inputMode="email" value={form.email} onChange={mudar('email')} maxLength={100} />
            </Campo>
            <Campo id="telefone" rotulo="Telefone com DDD" obrigatorio erro={erros.telefone}>
              <input type="tel" autoComplete="tel-national" inputMode="tel" value={form.telefone} onChange={mudar('telefone')} placeholder="(11) 98765-4321" />
            </Campo>
          </div>
          <fieldset>
            <legend className="mb-2 font-bold">Você doa como</legend>
            <div className="flex flex-wrap gap-6">
              {[['PF', 'Pessoa física'], ['PJ', 'Empresa ou instituição']].map(([valor, texto]) => (
                <label key={valor} className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="radio" name="tipo" value={valor} checked={form.tipo === valor}
                    onChange={mudar('tipo')} className="size-6 accent-lar" />
                  {texto}
                </label>
              ))}
            </div>
          </fieldset>
          {/* LGPD: o consentimento ainda não é gravado pela API; aqui ele só libera o envio. */}
          <div className="flex flex-col gap-1">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-linha p-3">
              <input id="consentimento" type="checkbox" checked={form.consentimento}
                onChange={(e) => setForm((f) => ({ ...f, consentimento: e.target.checked }))}
                aria-invalid={erros.consentimento ? true : undefined}
                aria-describedby={erros.consentimento ? 'consentimento-erro' : undefined}
                className="mt-1 size-6 shrink-0 accent-lar" />
              <span>
                Concordo que o Lar Ternura use meus dados (nome, e-mail e telefone) só para combinar esta entrega.
                <span aria-hidden="true" className="text-erro"> *</span>
              </span>
            </label>
            {erros.consentimento && <p id="consentimento-erro" className="text-sm font-bold text-erro">{erros.consentimento}</p>}
          </div>
        </fieldset>

        <Botao type="submit" carregando={enviando} className="self-start px-8 text-lg">Confirmar agendamento</Botao>
      </form>
    </div>
  );
}
