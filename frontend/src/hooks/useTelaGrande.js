import { useEffect, useState } from 'react';

const CONSULTA = '(min-width: 1024px)'; // mesmo ponto do lg do Tailwind

export function useTelaGrande() {
  const [grande, setGrande] = useState(() => window.matchMedia?.(CONSULTA).matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const aoMudar = () => setGrande(mq.matches);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);
  return grande;
}
