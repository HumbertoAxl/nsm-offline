// Preserve original update/render order, but let the browser paint a diagnostic
// before each first-frame phase. Subsequent game frames keep their normal loop.
export async function runStartupFrame(steps,beforeStep,yieldToBrowser){
 for(const [name,work] of steps){beforeStep(name);await yieldToBrowser();work();}
}
