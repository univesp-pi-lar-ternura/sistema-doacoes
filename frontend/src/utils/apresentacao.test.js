import { describe, it, expect } from 'vitest';
import { montarNome, lerConteudo, converter, descreverEquivalencia, contar } from './apresentacao.js';

describe('montarNome', () => {
  it('monta no padrão do projeto', () => {
    expect(montarNome({ produto: ' Macarrão  espaguete ', embalagem: 'pacote', conteudo: '500', medida: 'g' }))
      .toBe('Macarrão espaguete, pacote de 500 g');
    expect(montarNome({ produto: 'Óleo de soja', embalagem: 'garrafa', conteudo: '0.9', medida: 'L' }))
      .toBe('Óleo de soja, garrafa de 0,9 L');
    expect(montarNome({ produto: 'Fralda geriátrica G', embalagem: 'pacote', conteudo: '8', medida: 'un' }))
      .toBe('Fralda geriátrica G, pacote com 8 unidades');
    expect(montarNome({ produto: 'Cobertor de solteiro', embalagem: 'unidade' })).toBe('Cobertor de solteiro');
  });
});

describe('lerConteudo', () => {
  it('lê o conteúdo do nome, inclusive dos produtos já cadastrados', () => {
    expect(lerConteudo('Macarrão espaguete, pacote de 500 g')).toMatchObject({ quantidade: 500, medida: 'g', emBase: 500 });
    expect(lerConteudo('[DEMO] Arroz tipo 1 - pacote 5 kg')).toMatchObject({ emBase: 5000 });
    expect(lerConteudo('Óleo de soja, garrafa de 0,9 L')).toMatchObject({ quantidade: 0.9, medida: 'L', emBase: 900 });
    expect(lerConteudo('[DEMO] Fralda geriátrica G - pacote 8 unidades')).toBeNull();
    expect(lerConteudo('Kit higiene')).toBeNull();
    expect(lerConteudo('Gel 70%')).toBeNull();
  });
});

describe('converter', () => {
  const pacote500 = lerConteudo('pacote de 500 g');
  it('converte peso em unidades inteiras', () => {
    expect(converter(1, 'kg', pacote500)).toEqual({ unidades: 2, exato: true });
    expect(converter(3, 'kg', pacote500)).toEqual({ unidades: 6, exato: true });
    expect(converter(1200, 'g', pacote500)).toEqual({ unidades: 2.4, exato: false });
  });
  it('não mistura peso com volume', () => {
    expect(converter(1, 'L', pacote500)).toBeNull();
  });
});

describe('descreverEquivalencia', () => {
  it('mostra um exemplo com número inteiro de unidades', () => {
    expect(descreverEquivalencia('Macarrão espaguete, pacote de 500 g', 'pacotes')).toBe('Cada pacote tem 500 g. Exemplo: 1 kg = 2 pacotes.');
    expect(descreverEquivalencia('Leite em pó integral 400 g', 'latas')).toBe('Cada lata tem 400 g. Exemplo: 2 kg = 5 latas.');
    expect(descreverEquivalencia('Arroz tipo 1 - pacote 5 kg', 'pacotes')).toBe('Cada pacote tem 5 kg. Exemplo: 10 kg = 2 pacotes.');
    expect(descreverEquivalencia('Sabonete neutro 90 g', 'unidades')).toBe('Cada unidade tem 90 g.');
    expect(descreverEquivalencia('Cobertor de solteiro', 'unidades')).toBeNull();
  });
  it('usa singular e plural', () => {
    expect(contar(1, 'latas')).toBe('1 lata');
    expect(contar(3, 'latas')).toBe('3 latas');
  });
});
