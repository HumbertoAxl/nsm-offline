// The game always sees a landscape stage. When the phone is held (or locked)
// in portrait, the stage is turned so the game's top faces the left edge.
export function stageBox(viewWidth,viewHeight){
 const rotated=viewHeight>viewWidth;
 return {rotated,viewHeight,width:rotated?viewHeight:viewWidth,height:rotated?viewWidth:viewHeight};
}
// Screen point -> stage point. rotate(-90deg) after translate(0,vh) maps the
// stage point (x,y) to the screen point (y,vh-x).
export function toStage(box,clientX,clientY){
 return box.rotated?{x:box.viewHeight-clientY,y:clientX}:{x:clientX,y:clientY};
}
// Stage point -> canvas render coordinates. Offsets and client sizes are layout
// values, unaffected by the stage transform.
export function toCanvas(box,canvas,clientX,clientY){
 const p=toStage(box,clientX,clientY);
 return {x:(p.x-canvas.offsetLeft)*canvas.width/Math.max(1,canvas.clientWidth),y:(p.y-canvas.offsetTop)*canvas.height/Math.max(1,canvas.clientHeight)};
}
export function installStage(stage,{win=globalThis.window,root=globalThis.document?.documentElement}={}){
 let box=stageBox(win.innerWidth,win.innerHeight);
 const layout=()=>{
  box=stageBox(win.innerWidth,win.innerHeight);
  root.classList.toggle('rotated',box.rotated);
  stage.style.width=box.width+'px';stage.style.height=box.height+'px';
  stage.style.transform=box.rotated?`translate(0,${box.viewHeight}px) rotate(-90deg)`:'none';
 };
 layout();win.addEventListener('resize',layout);win.addEventListener('orientationchange',()=>setTimeout(layout,250));
 return {box:()=>box,layout};
}
