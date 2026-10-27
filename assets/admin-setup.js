const form=document.getElementById('admin-setup-form');
if(form){
 const username=document.getElementById('setup-username'),password=document.getElementById('setup-password'),confirm=document.getElementById('setup-confirm'),message=document.getElementById('setup-message'),button=document.getElementById('setup-submit');let busy=false;
 const show=text=>{message.textContent=text;};
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  if(password.value!==confirm.value){show('两次输入的密码不一致，请重新确认。');confirm.focus();return;}
  busy=true;button.disabled=true;button.textContent='正在创建…';form.setAttribute('aria-busy','true');
  for(const input of [username,password,confirm])input.readOnly=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  try {
   const response=await fetch('/api/setup',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({username:username.value,password:password.value,confirmPassword:confirm.value}),signal:controller.signal});
   const result=await response.json();
   if(!response.ok){show(result.error||'创建失败，请检查后重试。');return;}
   password.value='';confirm.value='';show('管理员已创建，正在进入后台…');
   location.replace(result.next==='/admin/'?'/admin/':'/admin/login/');
  }catch{show('连接未完成，请保留输入。不要重复提交：刷新页面确认账号是否已经创建后，再继续登录或设置。');}
  finally{clearTimeout(timeout);busy=false;button.disabled=false;button.textContent='创建账号并进入后台';form.removeAttribute('aria-busy');for(const input of [username,password,confirm])input.readOnly=false;}
 });
}
