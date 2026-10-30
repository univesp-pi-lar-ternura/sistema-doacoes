export const LOCAL_ENTREGA = {
  nome: 'Associação Lar Ternura',
  endereco: 'Rua Inácio Cervantes, 630 – Parque Ipê, São Paulo/SP – CEP 05572-000',
  instrucoes: 'Leve os itens no dia e horário agendados e informe o código da sua entrega na portaria.',
  mapa: 'https://www.google.com/maps/search/?api=1&query=Rua+In%C3%A1cio+Cervantes%2C+630%2C+S%C3%A3o+Paulo+SP',
};

export const CONTATO = {
  telefone: '(11) 3782-5949',
  whatsapp: '(11) 96628-3147',
  site: 'https://www.larternura.org.br/',
  instagram: 'https://www.instagram.com/lar_ternura/',
};

export function linkWhatsApp(telefone, mensagem = '') {
  let digitos = String(telefone).replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  const texto = mensagem ? '?text=' + encodeURIComponent(mensagem) : '';
  return `https://wa.me/${digitos}${texto}`;
}
