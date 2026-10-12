// One original update per presented frame. Never queue catch-up work after a stall.
export function createFrameGate(){let next=0;return(now,rate=60)=>{const interval=1000/Math.max(1,Math.min(240,rate||60));if(now+.5<next)return false;next=now+interval;return true;};}
