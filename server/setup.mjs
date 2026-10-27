import {hashPassword,login,digest} from '../worker/auth.js';

const headers={'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{...headers,'content-type':'application/json; charset=utf-8',...extra}});

export function localSetupConnection(req,config,url) {
  const peer=req.socket.remoteAddress?.replace(/^::ffff:/,'');
  // Loopback Host alone is not proof of a local connection. Require the actual
  // loopback socket or the explicitly trusted host gateway, with no proxy hints.
  return url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&
    (['127.0.0.1','::1'].includes(peer)||config.trusted.includes(peer))&&
    ['forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-real-ip','cf-connecting-ip'].every(name=>req.headers[name]===undefined);
}

function page(allowed,method) {
  const content=allowed?`<p class="setup-kicker">欢迎来到创作中心</p><h1>创建管理员账号</h1><p class="setup-description">这是此站点的首次设置。创建账号后，你就可以管理文章、图片和评论。</p>
<form id="admin-setup-form">
<label for="setup-username">管理员账号</label><input id="setup-username" name="username" autocomplete="username" value="admin" required minlength="3" maxlength="64" pattern="[a-z0-9][a-z0-9-]{2,63}" aria-describedby="username-help"><p id="username-help" class="field-help">3–64 个小写字母、数字或连字符。</p>
<label for="setup-password">设置密码</label><input id="setup-password" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" aria-describedby="password-help"><p id="password-help" class="field-help">12–128 个字符，建议使用密码管理器生成的独立密码。</p>
<label for="setup-confirm">确认密码</label><input id="setup-confirm" name="confirmPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="128">
<p id="setup-message" role="status" aria-live="polite"></p><button id="setup-submit" type="submit">创建账号并进入后台</button>
</form><p class="setup-footnote">仅需设置一次，已有文章和图片会保留。</p><noscript><p>请启用 JavaScript 后完成账号设置。</p></noscript><script type="module" src="/assets/admin-setup.js"></script>`:
`<p class="setup-kicker">首次设置</p><h1>尚未创建管理员</h1><p class="setup-description">请先通过 SSH 本地预览通道打开后台，完成管理员账号设置。设置完成后即可通过正式域名登录。</p><p class="setup-footnote">为保护站点，此入口不接受公网访问创建管理员。</p>`;
  const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>首次设置 · itfetter</title><link rel="icon" href="/assets/logo.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/admin-setup.css"></head><body><main class="setup-card"><a class="setup-brand" href="/" aria-label="访问博客"><img src="/assets/logo.svg" width="40" height="40" alt=""><span>itfetter<span class="brand-dot">.</span></span></a>${content}</main></body></html>`;
  return new Response(method==='HEAD'?null:html,{status:allowed?200:403,headers:{...headers,'content-type':'text/html; charset=utf-8'}});
}

async function readInput(request) {
  if(Number(request.headers.get('content-length'))>4096)throw Object.assign(Error('请求过大。'),{status:413});
  const reader=request.body?.getReader(),chunks=[];let size=0;
  if(reader)for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Object.assign(Error('请求过大。'),{status:413});}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Object.assign(Error('请提交有效的 JSON。'),{status:400});}
}

export async function firstRun(request,env,allowed) {
  const url=new URL(request.url),api=url.pathname==='/api/setup';
  if(!api&&!['/admin','/admin/','/admin/login','/admin/login/'].includes(url.pathname))return null;
  const exists=!!await env.DB.prepare('SELECT id FROM admin_users LIMIT 1').first();
  if(!api)return !exists&&['GET','HEAD'].includes(request.method)?page(allowed,request.method):null;
  if(request.method==='GET')return json({required:!exists,allowed:!exists&&allowed});
  if(request.method!=='POST')return json({error:'请使用 GET 或 POST。'},405);
  if(exists)return json({error:'管理员已创建，请使用登录页面。',next:'/admin/login/'},409);
  if(!allowed||request.headers.get('origin')!==url.origin)return json({error:'请通过 SSH 本地预览通道初始化管理员。'},403);
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return json({error:'请提交 JSON。'},415);
  try {
    const window=Math.floor(Date.now()/900000),key='setup:'+digest(request.headers.get('cf-connecting-ip')||'local');
    const attempt=await env.DB.prepare('INSERT INTO login_limits(key,window,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END,window=excluded.window RETURNING attempts').bind(key,window).first();
    if(attempt.attempts>10)return json({error:'尝试过于频繁，请稍后再试。'},429,{'retry-after':'900'});
    const data=await readInput(request);
    if(typeof data?.username!=='string'||!/^[a-z0-9][a-z0-9-]{2,63}$/.test(data.username))return json({error:'账号须为3–64个小写字母、数字或连字符。'},400);
    if(typeof data.password!=='string'||data.password.length<12||data.password.length>128)return json({error:'密码须为12–128个字符。'},400);
    if(data.password!==data.confirmPassword)return json({error:'两次输入的密码不一致。'},400);
    const hash=await hashPassword(data.password),version=new Date().toISOString()+':'+crypto.randomUUID();
    // The conditional INSERT is the authority. Two concurrent first-run requests
    // must never replace an administrator created while scrypt was in progress.
    const created=await env.DB.prepare('INSERT INTO admin_users(id,username,password_hash,updated_at) SELECT 1,?,?,? WHERE NOT EXISTS(SELECT 1 FROM admin_users) ON CONFLICT DO NOTHING').bind(data.username,hash,version).run();
    if(!created.meta.changes)return json({error:'管理员已在其他窗口创建，请登录。',next:'/admin/login/'},409);
    // Reuse the normal session implementation; successful creation is durable
    // even if starting the first session is temporarily unavailable.
    try {
      const session=await login(request,env,{username:data.username,password:data.password});
      if(session.ok)return json({ok:true,next:'/admin/'},201,{'set-cookie':session.headers.get('set-cookie')});
    }catch{/* Account is saved. Continue through the regular login page. */}
    return json({ok:true,next:'/admin/login/'},201);
  }catch(error){if(error.status)return json({error:error.message},error.status);console.error('Administrator initialization failed');return json({error:'初始化失败，请保留输入并稍后检查账号状态。'},500);}
}
