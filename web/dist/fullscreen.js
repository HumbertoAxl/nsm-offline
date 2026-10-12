// Shared browser presentation controls. Home Screen installation remains user initiated.
export function installFullscreen({button,status,target=document.documentElement,beforeRequest=()=>{},doc=document,nav=navigator,media=matchMedia,locale='en'}){
  const copy={
    enter:'Full screen',exit:'Exit full screen',installed:'Opened as an app',active:'Full screen enabled.',
    guide:'On iPhone: Share → Add to Home Screen → Open as Web App. Then launch from the icon. If Brave does not offer this action, open the same address in Safari or Chrome. Export your progress first: the app may use separate storage.',
    denied:'This browser did not allow full screen. On iPhone, use Add to Home Screen.'
  };
  const standalone=media('(display-mode: standalone)'),full=media('(display-mode: fullscreen)');
  const isApp=()=>nav.standalone===true||standalone.matches||full.matches;
  const active=()=>!!(doc.fullscreenElement||doc.webkitFullscreenElement);
  const refresh=()=>{button.disabled=isApp()&&!active();button.textContent=active()?copy.exit:isApp()?copy.installed:copy.enter;status.textContent=active()||isApp()?copy.active:copy.guide;};
  button.onclick=async()=>{
    if(active()){
      try{await (doc.exitFullscreen||doc.webkitExitFullscreen).call(doc);}catch{status.textContent=copy.denied;}
      return;
    }
    const request=target.requestFullscreen||target.webkitRequestFullscreen;
    if(!request){status.textContent=copy.guide;return;}
    try{beforeRequest();await request.call(target);refresh();}catch{status.textContent=copy.denied;}
  };
  doc.addEventListener('fullscreenchange',refresh);doc.addEventListener('webkitfullscreenchange',refresh);
  standalone.addEventListener?.('change',refresh);full.addEventListener?.('change',refresh);
  refresh();
}

