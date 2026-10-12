// iOS may deliver pointerdown without a subsequent pointerup/click. Activate
// primary touch/pen buttons immediately, with one scalar pointer token per
// button so an interrupted gesture cannot accumulate retained pointer records.
export function bindTouchAction(button,action,now=()=>performance.now()){
 let lastTouch=-Infinity,handledPointer=null;
 const mobile=event=>['touch','pen'].includes(event.pointerType)&&event.isPrimary!==false&&!button.disabled;
 button.onclick=event=>{if(now()-lastTouch<700)return;action(event);};
 button.addEventListener('pointerdown',event=>{
  if(!mobile(event))return;
  event.preventDefault();handledPointer=event.pointerId;lastTouch=now();action(event);
 });
 button.addEventListener('pointerup',event=>{
  if(!mobile(event))return;
  event.preventDefault();lastTouch=now();
  if(handledPointer===event.pointerId){handledPointer=null;return;}
  action(event);
 });
 button.addEventListener('pointercancel',()=>{handledPointer=null;});
}
