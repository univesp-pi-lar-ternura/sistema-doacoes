import { build, loadEnv } from 'vite';
import { validarConfiguracaoCloudflare } from './config-cloudflare.mjs';

// Mesma precedência de variáveis usada pelo Vite: processo sobre arquivos .env.
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
validarConfiguracaoCloudflare(env);
await build({ mode: 'production' });
