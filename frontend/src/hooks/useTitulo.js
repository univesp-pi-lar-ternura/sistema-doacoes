import { useEffect } from 'react';

/** Título da aba por página: leitores de tela anunciam a troca de página por ele. */
export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} | Lar Ternura` : 'Doações para o Lar Ternura';
  }, [titulo]);
}
