// Bound render resolution independently of CSS layout and original game rules.
export function renderSize(cssWidth,cssHeight,dpr=1){
 const w=Math.max(1,Number(cssWidth)||1),h=Math.max(1,Number(cssHeight)||1);
 const scale=Math.min(Math.max(1,Number(dpr)||1),2,Math.sqrt(2250000/(w*h)));
 return {width:Math.max(2,Math.floor(w*scale/2)*2),height:Math.max(2,Math.floor(h*scale/2)*2)};
}
export function installDisplay(canvas,onChange,{dpr=()=>globalThis.devicePixelRatio||1,observe=globalThis.ResizeObserver}={}){
 // Layout size, unaffected by the portrait stage rotation.
 const refresh=()=>{const rect=canvas.clientWidth?{width:canvas.clientWidth,height:canvas.clientHeight}:canvas.getBoundingClientRect(),size=renderSize(rect.width,rect.height,dpr());if(canvas.width!==size.width||canvas.height!==size.height){canvas.width=size.width;canvas.height=size.height;}onChange(size);};
 refresh();const observer=observe?new observe(refresh):null;observer?.observe(canvas);
 return {refresh,dispose:()=>observer?.disconnect()};
}
