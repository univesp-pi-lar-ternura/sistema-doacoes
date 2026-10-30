import { describe, it, expect } from 'vitest';
import { diasDeAtraso } from './formatar.js';
import { linkWhatsApp } from '../config.js';

describe('diasDeAtraso (dias de calendário em São Paulo)', () => {
  const agora = new Date('2026-10-19T15:00:00-03:00');

  it('horário futuro não é atraso', () => {
    expect(diasDeAtraso('2026-10-19T16:00:00', agora)).toBeNull();
    expect(diasDeAtraso('2026-10-25T09:00:00', agora)).toBeNull();
  });

  it('passou hoje conta 0; ontem 1; mês passado conta os dias', () => {
    expect(diasDeAtraso('2026-10-19T09:00:00', agora)).toBe(0);
    expect(diasDeAtraso('2026-10-18T16:00:00', agora)).toBe(1);
    expect(diasDeAtraso('2026-09-10T14:00:00', agora)).toBe(39);
  });

  it('usa o dia de São Paulo mesmo quando em UTC já é amanhã', () => {
    const noite = new Date('2026-10-19T23:30:00-03:00'); // 02:30 de 20/10 em UTC
    expect(diasDeAtraso('2026-10-18T10:00:00', noite)).toBe(1);
  });
});

describe('linkWhatsApp', () => {
  it('acrescenta 55 a números brasileiros e codifica a mensagem', () => {
    expect(linkWhatsApp('(11) 96628-3147')).toBe('https://wa.me/5511966283147');
    expect(linkWhatsApp('(11) 3782-5949', 'Olá, Lar!')).toBe('https://wa.me/551137825949?text=Ol%C3%A1%2C%20Lar!');
  });
});
