// Only saved documents qualify. Failed writes pause until explicit user action.
export function createDraftAutosave({ready,save,onPause=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,now=Date.now}) {
 let enabled=false,paused=false,timer=null,first=null,running=false;
 function cancel(){if(timer!==null)clearTimer(timer);timer=null;first=null}
 function changed(){
  if(!enabled||paused||!ready())return;
  if(first===null)first=now();
  if(timer!==null)clearTimer(timer);
  timer=setTimer(run,Math.min(3000,Math.max(0,30000-(now()-first))));
 }
 async function run(){
  timer=null;
  if(!enabled||paused||!ready()){cancel();return}
  if(running){changed();return}
  running=true;first=null;
  try{await save()}catch(error){paused=true;cancel();onPause(error)}
  finally{running=false;changed()}
 }
 return {changed,cancel,setEnabled(value){enabled=Boolean(value);paused=false;cancel();changed()},reset(){paused=false;cancel()},get enabled(){return enabled},get paused(){return paused}};
}
