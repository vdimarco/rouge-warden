// Public, free MagicPixel marketplace artwork. Crops use the supplied PNG atlas.
export const MARKETPLACE_SPRITES = [
  {id:'possessed-ogre',name:'Possessed Ogre',file:'possessed-ogre.png',crop:[0,0,512,512],height:255},
  {id:'undead-knight',name:'Undead Knight',file:'undead-rpg.png',crop:[0,0,512,512],height:195},
  {id:'undead-mage',name:'Undead Mage',file:'undead-rpg.png',crop:[512,0,512,512],height:205},
  {id:'undead-archer',name:'Undead Archer',file:'undead-rpg.png',crop:[0,512,512,512],height:195},
];
export function campSprite(camp,roll){return MARKETPLACE_SPRITES[(camp+roll)%MARKETPLACE_SPRITES.length];}
export function drawMarketplaceSprite(renderer,e,anchor,time){
  const sprite=MARKETPLACE_SPRITES.find(a=>a.id===e.marketplaceSprite),image=sprite&&renderer.art['marketplace-'+sprite.file];
  if(!image)return null;
  const c=renderer.ctx,h=sprite.height*renderer.scale,w=h,swing=e.attackAnim>0?Math.sin(Math.min(1,(e.attackDuration-e.attackAnim)/(e.attackDuration||.5))*Math.PI):0;
  const bob=e.moving?-Math.abs(Math.sin(time*9+e.id))*5:Math.sin(time*2+e.id)*1.5;
  c.save();c.imageSmoothingEnabled=false;c.translate(anchor.x,anchor.y+bob);if(Math.cos(e.facing)<0)c.scale(-1,1);c.rotate(swing*.08);if(e.hit>0)c.globalAlpha=.7;
  c.drawImage(image,...sprite.crop,-w/2,-h,w,h);c.restore();
  return {x:anchor.x-w/2,y:anchor.y-h+bob,w,h};
}
