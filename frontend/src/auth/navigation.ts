const locks=new Set<symbol>();
let currentIndex=0;
const indexKey='clinicNavigationIndex';
export function lockNavigation(){const key=Symbol();locks.add(key);return()=>{locks.delete(key);};}
export function initializeNavigation(){currentIndex=Number(window.history.state?.[indexKey]??0);window.history.replaceState({...window.history.state,[indexKey]:currentIndex},'');}
export function navigateLocal(url:string,replace=false){
 if(locks.size)return;
 const destination=new URL(url,window.location.origin);
 if(destination.origin!==window.location.origin)throw new Error('Đường dẫn đăng nhập không hợp lệ.');
 if(!replace)currentIndex++;
 window.history[replace?'replaceState':'pushState']({...window.history.state,[indexKey]:currentIndex},'',destination.pathname+destination.search+destination.hash);
 window.dispatchEvent(new Event('clinic:navigate'));
 if(destination.hash)requestAnimationFrame(()=>document.getElementById(decodeURIComponent(destination.hash.slice(1)))?.scrollIntoView({block:'start'}));
}
export function guardHistory(event:PopStateEvent){
 const next=event.state?.[indexKey];
 if(typeof next!=='number')return true;
 if(locks.size&&next!==currentIndex){event.stopImmediatePropagation();window.history.go(currentIndex-next);return false;}
 currentIndex=next;
 return true;
}
