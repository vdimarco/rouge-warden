import {coinJumpHeight} from './jump-rewards.js';

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
