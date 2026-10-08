// Canvas character atlas inspired by ascii.rest's MIT-licensed renderer.
// Scene modules are original bas3line/ascii source with type annotations removed.
const cache = new WeakMap();
export function mount(canvas, piece, { fps = 12 } = {}) {
  let saved = cache.get(canvas);
  if (!saved || saved.piece !== piece) {
    saved = { piece, time: 0, frame:piece.default(), color:new Uint8Array(piece.meta.cols*piece.meta.rows) };
    cache.set(canvas,saved);
  }
  const ctx=canvas.getContext('2d'), {cols,rows,palette,ground}=piece.meta;
  const atlas=document.createElement('canvas'), actx=atlas.getContext('2d');
  let cells=[], cell=0, ratio=1, raf=0, last=0, disposed=false;
  function size() {
    ratio=Math.min(devicePixelRatio||1,2);
    cell=canvas.clientWidth*ratio/cols;
    canvas.width=Math.round(cols*cell);canvas.height=Math.round(rows*cell);
    const slot=Math.ceil(cell)+2;
    atlas.width=slot*4;atlas.height=slot*palette.length;
    cells=[];
    actx.font=(cell/0.6)+'px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
    actx.textAlign='center';actx.textBaseline='middle';
    for(let c=0;c<palette.length;c++) {
      actx.fillStyle=palette[c];
      for(let g=0;g<4;g++) {
        actx.fillText(' ·•●'[g],g*slot+slot/2,c*slot+slot/2);
        cells[c*4+g]=[g*slot,c*slot,slot,slot];
      }
    }
    draw();
  }
  function draw() {
    const lines=saved.frame(saved.time,{color:saved.color}).split('\n');
    ctx.fillStyle=ground;ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
      const ch=lines[y][x], g=' ·•●'.indexOf(ch);
      if(g<=0)continue;
      const a=cells[saved.color[y*cols+x]*4+g];
      ctx.drawImage(atlas,a[0],a[1],a[2],a[3],x*cell-1,y*cell-1,cell+2,cell+2);
    }
  }
  function tick(now) {
    if(disposed)return;
    raf=requestAnimationFrame(tick);
    if(now-last<1000/fps)return;
    saved.time+=last?Math.min(.1,(now-last)/1000):0;
    last=now;draw();
  }
  const observer=new ResizeObserver(size);
  observer.observe(canvas);size();
  if(fps>0)raf=requestAnimationFrame(tick);
  return ()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();};
}

