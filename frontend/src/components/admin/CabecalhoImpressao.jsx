import { formatarDataHora } from '../../utils/formatar.js';

/** Identificação do documento, só no papel ou no PDF (escondida na tela). */
export function CabecalhoImpressao({ detalhe }) {
  return (
    <div className="so-impressao mb-4 border-b-2 border-marca-laranja pb-3">
      <div className="flex items-center gap-3">
        <img src="/logo-lar-ternura-192.png" alt="" width="48" height="48" className="size-12" />
        <div>
          <p className="font-titulo text-lg font-extrabold">Associação Lar Ternura</p>
          <p className="text-sm">Emitido em {formatarDataHora(new Date().toISOString())}{detalhe ? `. ${detalhe}` : ''}</p>
        </div>
      </div>
    </div>
  );
}
