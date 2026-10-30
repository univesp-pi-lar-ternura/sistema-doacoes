// Apresentação do produto e equivalência entre peso/volume e unidades de contagem.
// O banco guarda só `nome_item` e `unidade_medida`; a apresentação ("pacote de 500 g") faz
// parte do nome. Aqui o front monta esse nome num padrão fixo e lê o conteúdo de volta para
// mostrar equivalências. A quantidade gravada é sempre um inteiro na unidade de contagem.

/** Unidades de contagem aceitas no cadastro: [singular, plural]. */
export const UNIDADES_CONTAGEM = [
  ['pacote', 'pacotes'],
  ['lata', 'latas'],
  ['caixa', 'caixas'],
  ['frasco', 'frascos'],
  ['garrafa', 'garrafas'],
  ['saco', 'sacos'],
  ['fardo', 'fardos'],
  ['rolo', 'rolos'],
  ['unidade', 'unidades'],
];

/** Medidas do conteúdo de cada embalagem. `base` agrupa as que se convertem entre si. */
export const MEDIDAS = {
  g: { base: 'g', fator: 1, rotulo: 'gramas (g)' },
  kg: { base: 'g', fator: 1000, rotulo: 'quilos (kg)' },
  ml: { base: 'ml', fator: 1, rotulo: 'mililitros (ml)' },
  L: { base: 'ml', fator: 1000, rotulo: 'litros (L)' },
  un: { base: 'un', fator: 1, rotulo: 'unidades dentro da embalagem' },
};

const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const numero = (n) => fmt.format(n);

export function singular(unidadePlural = '') {
  const par = UNIDADES_CONTAGEM.find(([, p]) => p === unidadePlural);
  return par ? par[0] : unidadePlural;
}

export function contar(n, unidadePlural) {
  return `${numero(n)} ${n === 1 ? singular(unidadePlural) : unidadePlural}`;
}

function normalizarMedida(texto = '') {
  const t = texto.toLowerCase();
  if (t === 'l' || t === 'litro' || t === 'litros') return 'L';
  if (t === 'ml') return 'ml';
  if (t === 'kg') return 'kg';
  if (t === 'g') return 'g';
  return null;
}

/**
 * Monta o nome no padrão do projeto:
 *   Macarrão espaguete, pacote de 500 g
 *   Fralda geriátrica G, pacote com 8 unidades
 *   Cobertor de solteiro            (sem conteúdo informado)
 */
export function montarNome({ produto = '', embalagem = '', conteudo = '', medida = '' }) {
  const p = produto.trim().replace(/\s+/g, ' ');
  if (!p) return '';
  const qtd = String(conteudo).trim().replace('.', ',');
  if (!embalagem || !qtd || !medida) return p;
  if (medida === 'un') return `${p}, ${embalagem} com ${qtd} ${qtd === '1' ? 'unidade' : 'unidades'}`;
  return `${p}, ${embalagem} de ${qtd} ${medida}`;
}

/** Conteúdo de cada unidade, lido do nome ("... 500 g", "... 1,5 L"). null se não houver. */
export function lerConteudo(nome = '') {
  const achados = [...nome.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)(?![\p{L}])/giu)];
  const ultimo = achados.at(-1);
  if (!ultimo) return null;
  const quantidade = Number(ultimo[1].replace(',', '.'));
  const medida = normalizarMedida(ultimo[2]);
  if (!(quantidade > 0) || !medida) return null;
  return { quantidade, medida, base: MEDIDAS[medida].base, emBase: quantidade * MEDIDAS[medida].fator };
}

/**
 * Converte uma quantidade em peso/volume para unidades de contagem.
 * Ex.: 3 kg de "pacote de 500 g" -> { unidades: 6, exato: true }.
 */
export function converter(quantidade, medida, conteudo) {
  const m = MEDIDAS[medida];
  if (!conteudo || !m || m.base !== conteudo.base || !(quantidade > 0)) return null;
  const unidades = (quantidade * m.fator) / conteudo.emBase;
  const arredondado = Math.round(unidades * 1000) / 1000;
  return { unidades: arredondado, exato: Number.isInteger(arredondado) };
}

/**
 * Frase de equivalência para mostrar na tela, ou null se o nome não traz peso/volume.
 * Para embalagens pequenas, procura de 1 a 5 kg (ou L) o primeiro total que dá unidades inteiras.
 */
export function descreverEquivalencia(nome, unidadePlural) {
  const c = lerConteudo(nome);
  if (!c) return null;
  const um = `Cada ${singular(unidadePlural)} tem ${numero(c.quantidade)} ${c.medida}.`;
  if (c.emBase >= 1000) {
    return `${um} Exemplo: ${numero(c.quantidade * 2)} ${c.medida} = ${contar(2, unidadePlural)}.`;
  }
  const grande = c.base === 'g' ? 'kg' : 'L';
  for (let k = 1; k <= 5; k += 1) {
    const r = converter(k, grande, c);
    if (r?.exato) return `${um} Exemplo: ${numero(k)} ${grande} = ${contar(r.unidades, unidadePlural)}.`;
  }
  return um;
}
