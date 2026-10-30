export function linkGoogleAgenda({ titulo, inicioIso, duracaoMin = 30, detalhes = '', local = '' }) {
  const inicio = new Date(inicioIso);
  const fim = new Date(inicio.getTime() + duracaoMin * 60000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo,
    dates: `${fmt(inicio)}/${fmt(fim)}`,
    details: detalhes,
    location: local,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
