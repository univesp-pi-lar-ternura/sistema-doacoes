function loadConfig(env=process.env) {
  if(!env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória.');
  if(!env.BOOKING_TOKEN_SECRET||env.BOOKING_TOKEN_SECRET.length<32) throw new Error('BOOKING_TOKEN_SECRET precisa de pelo menos 32 caracteres.');
  const times=(env.DELIVERY_TIMES||'09:00,10:00,14:00,15:00').split(',').map(s=>s.trim());
  if(!times.length||times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||new Set(times).size!==times.length) throw new Error('DELIVERY_TIMES inválido.');
  const number=(v,def,max,label,min=1)=>{
    const n=v===undefined?def:Number(v);if(!Number.isInteger(n)||n<min||n>max) throw new Error(label+' inválido.');return n;
  };
  return {databaseUrl:env.DATABASE_URL,secret:env.BOOKING_TOKEN_SECRET,times:times.sort(),
  capacity:number(env.SLOT_CAPACITY,3,1000,'SLOT_CAPACITY'),sessionHours:number(env.SESSION_HOURS,8,24,'SESSION_HOURS'),
  port:number(env.PORT,3000,65535,'PORT'),proxyHops:number(env.TRUST_PROXY_HOPS,0,5,'TRUST_PROXY_HOPS',0),
  origins:(env.CORS_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean)};
}
module.exports={loadConfig};
