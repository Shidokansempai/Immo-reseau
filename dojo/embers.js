(function(){let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;
const c=document.querySelector('.c'),W=c.clientWidth,H=c.clientHeight;
for(let i=0;i<70;i++){const e=document.createElement('i');e.className='ember';const z=1+r()*5;
e.style.cssText=`left:${r()*W}px;top:${H*0.35+r()*H*0.65}px;width:${z}px;height:${z}px;opacity:${.35+r()*.65}`;c.insertBefore(e,c.querySelector('.vign'));}})();
