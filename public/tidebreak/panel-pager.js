// Paginate long panels by measured block height. No vertical scroll traps or lost actions.
export function paginatePanel(content) {
  if(content.querySelector('.panel-pages'))return;
  const source=[...content.children],stage=document.createElement('div'),navigation=document.createElement('nav');
  stage.className='panel-pages';navigation.className='panel-pagination';navigation.setAttribute('aria-label','Panel pages');
  navigation.innerHTML='<button aria-label="Previous panel page">‹</button><output aria-live="polite"></output><button aria-label="Next panel page">›</button>';
  content.replaceChildren(stage,navigation);
  let available=stage.clientHeight;const blocks=[];
  function unpack(node){
    stage.replaceChildren(node);
    if(node.scrollHeight>available&&node.children.length&&['DIV','UL','OL','DL','SECTION'].includes(node.tagName)){
      if(node.matches('.market-grid,.market-builds,.market-tabs,.recipe,.upgrade-path')){
        const children=[...node.children];for(let i=0;i<children.length;i+=4){const group=node.cloneNode(false);group.classList.add('paged-group');group.append(...children.slice(i,i+4));blocks.push(group);}
      }else if(node.tagName==='DL'){
        const children=[...node.children];for(let i=0;i<children.length;i+=2){const group=node.cloneNode(false);group.append(...children.slice(i,i+2));blocks.push(group);}
      }else [...node.children].forEach(unpack);
    }else blocks.push(node);
  }
  source.forEach(unpack);stage.replaceChildren();
  const [previous,next]=navigation.querySelectorAll('button'),status=navigation.querySelector('output');
  let pages=[],current=0,lastWidth=content.clientWidth,lastHeight=content.clientHeight;
  const show=()=>{pages.forEach((p,i)=>p.hidden=i!==current);previous.disabled=current===0;next.disabled=current===pages.length-1;status.textContent=`${current+1} / ${pages.length}`;navigation.hidden=pages.length<2;};
  function layout(){
    available=stage.clientHeight;stage.replaceChildren();pages=[];
    let page=document.createElement('section');page.className='panel-page';stage.append(page);pages.push(page);
    for(const block of blocks){page.append(block);if(page.scrollHeight>available&&page.children.length>1){block.remove();page.hidden=true;page=document.createElement('section');page.className='panel-page';page.append(block);stage.append(page);pages.push(page);}}
    current=Math.min(current,pages.length-1);show();
  }
  previous.onclick=()=>{current=Math.max(0,current-1);show();};next.onclick=()=>{current=Math.min(pages.length-1,current+1);show();};layout();
  const observer=new ResizeObserver(()=>{
    if(!content.isConnected||!stage.isConnected){observer.disconnect();return;}
    if(lastWidth===content.clientWidth&&lastHeight===content.clientHeight)return;
    lastWidth=content.clientWidth;lastHeight=content.clientHeight;available=stage.clientHeight;
    const existing=blocks.splice(0);existing.forEach(unpack);layout();
  });observer.observe(content);
}
