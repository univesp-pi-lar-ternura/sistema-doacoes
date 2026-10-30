import { describe, it, expect } from 'vitest';
import { validarConfiguracaoCloudflare } from './config-cloudflare.mjs';

describe('configuração de publicação Cloudflare', () => {
  const valido = { VITE_API_URL: 'https://api.larternura.org', VITE_USAR_MOCK: 'false' };
  it('aceita API HTTPS com mock explicitamente desativado', () => {
    expect(() => validarConfiguracaoCloudflare(valido)).not.toThrow();
  });
  it.each([undefined, '', 'true'])('recusa configuração de mock %s', (mock) => {
    expect(() => validarConfiguracaoCloudflare({ ...valido, VITE_USAR_MOCK: mock })).toThrow();
  });
  it.each([undefined, '', 'http://api.larternura.org', 'https://localhost:3000',
    'https://127.0.0.1', 'https://[::1]', 'https://api.example.com', 'https://api.invalid',
    'https://usuario:senha@api.larternura.org', 'https://api.larternura.org?token=x',
    'https://api.larternura.org#x'])('recusa URL inadequada %s', (url) => {
    expect(() => validarConfiguracaoCloudflare({ ...valido, VITE_API_URL: url })).toThrow();
  });
});
