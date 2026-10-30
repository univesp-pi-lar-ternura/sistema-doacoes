import { useState } from 'react';
import { useTitulo } from '../../hooks/useTitulo.js';
import { CabecalhoPagina, Painel } from '../../components/admin/LayoutAdmin.jsx';
import { FormRecebimento } from '../../components/admin/FormRecebimento.jsx';

export default function RegistrarDoacao() {
  useTitulo('Registrar doação');
  
  const [rodada, setRodada] = useState(0);
  const [concluidas, setConcluidas] = useState(0);

  return (
    <div>
      <CabecalhoPagina titulo="Registrar doação"
        descricao="Para doações que chegaram sem agendamento. Se a pessoa tinha agendado, use Doações agendadas e clique em Concluído." />
      {concluidas > 0 && (
        <p role="status" className="mb-4 font-bold text-sucesso">
          {concluidas === 1 ? '1 doação registrada nesta sessão.' : `${concluidas} doações registradas nesta sessão.`}
        </p>
      )}
      <Painel>
        <FormRecebimento key={rodada} aoConcluir={() => { setConcluidas((n) => n + 1); setRodada((n) => n + 1); }} />
      </Painel>
    </div>
  );
}
