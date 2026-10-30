import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useTitulo } from '../../hooks/useTitulo.js';
import { Campo } from '../../components/ui/Campo.jsx';
import { Botao } from '../../components/ui/Botao.jsx';
import { Alerta } from '../../components/ui/Alerta.jsx';
import { AvisoModoSimulado } from '../../components/AvisoModoSimulado.jsx';
import { USAR_MOCK } from '../../api/cliente.js';

export default function Entrar() {
  useTitulo('Entrar no painel');
  const { usuario, entrar, sessaoExpirou } = useAuth();
  const navegar = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={state?.voltarPara ?? '/admin'} replace />;

  async function enviar(e) {
    e.preventDefault();
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await entrar(email, senha);
      navegar(state?.voltarPara ?? '/admin', { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-nevoa">
      <AvisoModoSimulado />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-xl border border-linha bg-papel p-8">
          <h1 className="text-2xl font-bold">Painel do Lar Ternura</h1>
          <p className="mt-1 text-tinta-suave">Entre com o e-mail e a senha que você recebeu.</p>

          <form onSubmit={enviar} noValidate className="mt-6 flex flex-col gap-4">
            {sessaoExpirou && !erro && <Alerta tipo="atencao">Sua sessão terminou. Entre de novo para continuar.</Alerta>}
            {erro && <Alerta tipo="erro">{erro}</Alerta>}
            <Campo rotulo="E-mail">
              <input type="email" autoComplete="username" inputMode="email" value={email}
                onChange={(e) => setEmail(e.target.value)} autoFocus />
            </Campo>
            <div className="flex flex-col gap-1">
              <Campo rotulo="Senha">
                <input type={mostrarSenha ? 'text' : 'password'} autoComplete="current-password"
                  value={senha} onChange={(e) => setSenha(e.target.value)} />
              </Campo>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 self-start">
                <input type="checkbox" className="size-5 accent-lar" checked={mostrarSenha}
                  onChange={(e) => setMostrarSenha(e.target.checked)} />
                Mostrar senha
              </label>
            </div>
            <Botao type="submit" largo carregando={enviando}>Entrar</Botao>
          </form>

          <p className="mt-6 text-sm text-tinta-suave">
            Esqueceu a senha? Fale com quem cuida do sistema no Lar Ternura.
          </p>
          {USAR_MOCK && (
            <div className="mt-4 rounded-lg bg-media-claro p-3 text-sm">
              <p className="font-bold">Conta de demonstração</p>
              <p>E-mail: admin@demo.org</p>
              <p>Senha: demo12345</p>
            </div>
          )}
          <Link to="/" className="mt-6 inline-flex min-h-11 items-center text-lar underline underline-offset-2">
            Voltar para o site de doações
          </Link>
        </div>
      </main>
    </div>
  );
}
