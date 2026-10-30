const {randomBytes,createHash,createHmac,scrypt,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');
const derive=promisify(scrypt);
const token=()=>randomBytes(32).toString('hex');
const hash=v=>createHash('sha256').update(v).digest('hex');
const bookingToken=(key,secret)=>createHmac('sha256',secret).update('agendamento:'+key).digest('hex');
async function hashPassword(password) {
  const salt=randomBytes(16).toString('hex'),key=await derive(password,salt,32,{N:16384,r:8,p:1});
  return 'scrypt$16384$8$1$'+salt+'$'+key.toString('hex');
}
async function verifyPassword(password,encoded) {
  const p=String(encoded).split('$');
  if(p.length!==6||p.slice(0,4).join('$')!=='scrypt$16384$8$1'||!/^[a-f0-9]{32}$/.test(p[4])||!/^[a-f0-9]{64}$/.test(p[5])) return false;
  const key=await derive(password,p[4],32,{N:16384,r:8,p:1});return timingSafeEqual(key,Buffer.from(p[5],'hex'));
}
function bearer(req) {const m=/^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization')||'');return m?m[1]:null;}
function limiter(max,windowMs) {
  const buckets=new Map();
  return (req,res,next)=>{
    const now=Date.now();for(const [ip,b] of buckets) if(b.until<=now) buckets.delete(ip);
    let b=buckets.get(req.ip);
    if(!b) {
      if(buckets.size>=10000) return res.status(429).json({erro:{codigo:'LIMITE',mensagem:'Tente novamente mais tarde.'}});
      b={count:0,until:now+windowMs};buckets.set(req.ip,b);
    }
    if(++b.count>max) {res.set('Retry-After',String(Math.ceil((b.until-now)/1000)));return res.status(429).json({erro:{codigo:'LIMITE',mensagem:'Muitas tentativas. Tente novamente mais tarde.'}});}
    next();
  };
}
module.exports={token,hash,bookingToken,hashPassword,verifyPassword,bearer,limiter};
