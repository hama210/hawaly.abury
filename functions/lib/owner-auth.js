// Cloudflare Access JWT verification for HAWAL's owner-only monitoring.
// No "admin" role grants entry. No header/cookie email can bypass signatures.
// Access settings are mandatory: unset values always DENY, never allow a guest.
const ownerHeaders={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff'};

export const accessDenied=(message='Owner authentication required',status=403)=>
  new Response(message,{status,headers:{...ownerHeaders,'Content-Type':'text/plain; charset=utf-8'}});
export const ownerResponseHeaders=ownerHeaders;

function decodeUrlBase64(value) {
  if(typeof value!=='string'||!/^[a-zA-Z0-9_-]+$/.test(value)||value.length>8192)throw Error('Invalid token');
  const binary=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));
  return Uint8Array.from(binary,character=>character.charCodeAt(0));
}
function tokenPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeUrlBase64(value)));
}
export function accessConfiguration(env={}) {
  const domain=String(env.HAWAL_ACCESS_TEAM_DOMAIN||'').trim().replace(/\/$/,'');
  const audience=String(env.HAWAL_ACCESS_AUD||'').trim();
  const owner=String(env.HAWAL_OWNER_EMAIL||'').trim().toLowerCase();
  if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)
    || !/^[a-z0-9]{16,128}$/i.test(audience)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner))return null;
  return {domain,audience,owner};
}

export async function ownerAuthorized(request,env,fetchImpl=fetch,now=Date.now()){
  const settings=accessConfiguration(env);
  if(!settings)return false;
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token||token.length>12000)return false;
  const segments=token.split('.');
  if(segments.length!==3)return false;
  try {
    const [encodedHeader,encodedBody,encodedSignature]=segments;
    const header=tokenPart(encodedHeader),claims=tokenPart(encodedBody);
    if(header?.alg!=='RS256'||typeof header.kid!=='string'||!header.kid||header.kid.length>160)return false;
    if(claims?.iss!==settings.domain||
      !(typeof claims.aud==='string'?claims.aud===settings.audience:
        Array.isArray(claims.aud)&&claims.aud.includes(settings.audience)))return false;
    const seconds=Math.floor(now/1000);
    if(!Number.isFinite(claims.exp)||claims.exp<=seconds
      ||!Number.isFinite(claims.iat)||claims.iat>seconds+60
      ||(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>seconds+60)))return false;
    if(typeof claims.email!=='string'||claims.email.trim().toLowerCase()!==settings.owner)return false;
    // Fetch keys only from the configured Access team domain, not JWT 'jku'/'iss' URLs.
    const certs=await fetchImpl(settings.domain+'/cdn-cgi/access/certs',{
      headers:{Accept:'application/json'},signal:AbortSignal.timeout(4500),
      cf:{cacheTtl:300}
    });
    if(!certs.ok)return false;
    const payload=await certs.json();
    const jwk=Array.isArray(payload?.keys)?payload.keys.find(key=>key.kid===header.kid&&key.kty==='RSA'&&key.alg==='RS256'&&key.use==='sig'):null;
    if(!jwk||typeof jwk.n!=='string'||typeof jwk.e!=='string')return false;
    const key=await crypto.subtle.importKey('jwk',{kty:'RSA',n:jwk.n,e:jwk.e,alg:'RS256',ext:true},
      {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const signature=decodeUrlBase64(encodedSignature);
    return crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,signature,
      new TextEncoder().encode(encodedHeader+'.'+encodedBody));
  } catch {return false;}
}
