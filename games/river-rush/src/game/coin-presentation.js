import {coinJumpHeight} from './jump-rewards.js';

// Appearance follows the token's actual denomination, not a suggested route.
// These two prepared styles also survive reduced motion and monochrome-looking
// distant scenery: the richer token has a larger, wider raised rim.
const ordinary=Object.freeze({premium:false,appearance:'gold-coin',color:'#ffcf49',rimColor:'#ffcf49',glow:'#ffcf5f28',scale:1,thickness:1,rimScale:1});
const guarded=Object.freeze({premium:true,appearance:'premium-medal',color:'#ff922e',rimColor:'#ffe0a0',glow:'#ff9b5148',scale:1.18,thickness:.72,rimScale:1.35});
export function coinAppearance(coin){return coin.coinValue>10?guarded:ordinary;}

// Generated routes use the same normalized lift as the raft. Legacy isolated
// coins keep their existing low/high appearance.
export function coinWorldHeight(coin){
 const height=coinJumpHeight(coin);
 return height===null?(coin.high?3.1:1.2):1.2+height*2.9;
}
export function coinPixelLift(coin,heroWidth,scale=1){
 const height=coinJumpHeight(coin);
 return heroWidth*scale*(height===null?(coin.high?.5:0):height*.95);
}
export function coinFlightPixelLift(coin,heroWidth){
 const height=coinJumpHeight(coin);
 return heroWidth*(height===null?(coin.high?.8:.25):.28*.43+height*.95);
}
