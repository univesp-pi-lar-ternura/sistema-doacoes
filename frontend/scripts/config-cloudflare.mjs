export function validarConfiguracaoCloudflare(env) {
  if (env.VITE_USAR_MOCK !== 'false') {
    throw new Error('Defina VITE_USAR_MOCK=false para publicar a interface com a API real.');
  }
  let url;
  try {
    url = new URL(env.VITE_API_URL);
  } catch {
    throw new Error('Defina VITE_API_URL com o endereço HTTPS público da API.');
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' ||
      host.startsWith('127.') || /(^|\.)(example\.(com|org|net)|invalid|test|local)$/.test(host)) {
    throw new Error('VITE_API_URL deve ser um endereço HTTPS público, sem credenciais, parâmetros ou fragmentos.');
  }
}
