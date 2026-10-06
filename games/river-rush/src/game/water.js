import { riverRate } from './quality.js';
// Animate the generated water texture. Shorelines remain the original art.
const scenes = new WeakMap();
const vertex = `attribute vec2 a_position; varying vec2 v_uv;
void main(){gl_Position=vec4(a_position,0.,1.);v_uv=vec2(a_position.x*.5+.5,.5-a_position.y*.5);}`;
const fragment = `precision mediump float;
uniform sampler2D u_image;uniform float u_time;uniform float u_horizon;varying vec2 v_uv;
void main(){
  float depth=clamp((v_uv.y-u_horizon)/(1.-u_horizon),0.,1.);
  float channel=mix(.095,.64,smoothstep(0.,.38,depth));
  float bank=1.-smoothstep(channel-.045,channel,abs(v_uv.x-.5));
  float mask=bank*smoothstep(.005,.09,depth);
  float phase=fract(u_time*.31);float second=fract(phase+.5);
  float blend=abs(phase-.5)*2.;
  float strength=smoothstep(0.,.65,depth);
  vec2 flow=vec2(sin(v_uv.y*25.+u_time*.8)*.014,-.12)*strength;
  vec2 ripple=vec2(sin(v_uv.y*85.-u_time*3.1),cos(v_uv.x*75.+v_uv.y*38.-u_time*2.4))*.0028*strength;
  vec3 a=texture2D(u_image,clamp(v_uv+flow*phase+ripple,.001,.999)).rgb;
  vec3 b=texture2D(u_image,clamp(v_uv+flow*second+ripple,.001,.999)).rgb;
  gl_FragColor=vec4(mix(a,b,blend),mask*.96);
}`;
function createScene(art) {
  try {
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true,premultipliedAlpha:false});
    if(!gl)return null;
    const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Water shader unavailable');return s;};
    const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Water renderer unavailable');
    gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program,'u_image'),0);
    const state={canvas,gl,texture,source:null,time:-1,lost:false,timeLocation:gl.getUniformLocation(program,'u_time'),horizonLocation:gl.getUniformLocation(program,'u_horizon')};
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.lost=true;});
    canvas.addEventListener('webglcontextrestored',()=>scenes.delete(art));
    return state;
  }catch{return null;}
}
const videos = new WeakMap();
function videoWater(ctx,g,art,width,height,active,disabled){
  let state=videos.get(art);
  if(!state){state={clips:{},key:''};videos.set(art,state);}
  const key=width/height<.85?'portrait':'landscape';
  for(const [name,clip] of Object.entries(state.clips)){
    if(!active||disabled||name!==key)clip.pause();
    if(disabled||name!==key)clip.style.display='none';
  }
  if(disabled)return false;
  if(!state.clips[key]&&active){
    const clip=document.createElement('video');clip.muted=true;clip.loop=true;clip.playsInline=true;clip.preload='auto';clip.className='game-river-video';clip.setAttribute('aria-hidden','true');
    clip.src=`${import.meta.env.BASE_URL}art/river-${key}-flow.mp4`;
    clip.addEventListener('error',()=>{clip.failed=true;clip.style.display='none';});state.clips[key]=clip;
  }
  const clip=state.clips[key];if(!clip||clip.failed)return false;
  if(!active)return state.key===key&&clip.isConnected&&clip.style.display!=='none'&&clip.readyState>=2;
  if(clip.paused&&!clip.starting){clip.starting=true;clip.play().catch(error=>{if(error.name!=='AbortError')clip.failed=true;}).finally(()=>{clip.starting=false;});}
  const rate=riverRate(g.speed);if(Math.abs(clip.playbackRate-rate)>.03)clip.playbackRate=rate;
  if(clip.readyState<2)return false;
  // Let the browser composite decoded video directly. Copying it through a
  // full canvas texture every frame introduces upload stalls on real devices.
  const canvas=ctx.canvas,host=canvas.parentElement;
  if(!host)return false;
  if(clip.parentElement!==host)host.insertBefore(clip,canvas);
  clip.style.display='block';state.key=key;
  return true;
}
export function drawWater(ctx,g,art,width,height,reducedMotion,active=true) {
  const portrait=width/height<.85,source=portrait?art.portrait:art.environment;
  const disabled=reducedMotion||navigator.connection?.saveData;
  if(videoWater(ctx,g,art,width,height,active,disabled))return true;
  ctx.drawImage(source,0,0,width,height);
  if(disabled)return false;
  const clip=videos.get(art)?.clips[portrait?'portrait':'landscape'];
  if(!clip?.failed&&g.time<1.2)return false;
  if(!scenes.has(art))scenes.set(art,createScene(art));
  const state=scenes.get(art);if(!state||state.lost)return false;
  try {
    const {gl,canvas}=state,scale=Math.min(1,1024/Math.max(width,height)),w=Math.round(width*scale),h=Math.round(height*scale);
    const resized=canvas.width!==w||canvas.height!==h;
    if(resized){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
    const changed=state.source!==source;
    if(changed){gl.bindTexture(gl.TEXTURE_2D,state.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);state.source=source;}
    if(resized||changed||state.time!==g.time){
      gl.uniform1f(state.timeLocation,g.distance/24);gl.uniform1f(state.horizonLocation,portrait?.325:.35);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);state.time=g.time;
    }
    ctx.drawImage(canvas,0,0,width,height);return true;
  }catch{state.lost=true;return false;}
}

export function pauseWater(art){const state=videos.get(art);if(state)for(const clip of Object.values(state.clips)){clip.pause();if(!document.querySelector('.game-canvas'))clip.remove();}}
