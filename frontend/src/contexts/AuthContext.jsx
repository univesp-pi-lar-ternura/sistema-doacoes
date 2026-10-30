import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { entrar as apiEntrar, obterUsuarioAtual, sairDaSessao } from '../api/index.js';
import { registrarAoPerderSessao, sessao } from '../api/cliente.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(sessao.ler()));
  const [sessaoExpirou, setSessaoExpirou] = useState(false);

  useEffect(() => {
    registrarAoPerderSessao(() => {
      setUsuario(null);
      setSessaoExpirou(true);
    });
    if (!sessao.ler()) return;
    obterUsuarioAtual()
      .then(setUsuario)
      .catch(() => sessao.apagar())
      .finally(() => setCarregando(false));
  }, []);

  const entrar = useCallback(async (email, senha) => {
    const resposta = await apiEntrar(email.trim(), senha);
    sessao.salvar(resposta.token);
    setSessaoExpirou(false);
    setUsuario(resposta.usuario);
    return resposta.usuario;
  }, []);

  /** Revoga a sessão na API e apaga o token local. */
  const sair = useCallback(async () => {
    await sairDaSessao();
    sessao.apagar();
    setUsuario(null);
  }, []);

  const valor = useMemo(() => ({
    usuario,
    carregando,
    sessaoExpirou,
    entrar,
    sair,
  }), [usuario, carregando, sessaoExpirou, entrar, sair]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
