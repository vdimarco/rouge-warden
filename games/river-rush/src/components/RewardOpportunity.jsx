import React from 'react';
import { Icon } from './Icons.jsx';

function Direction({ direction }) {
  return <span className="reward-direction">{direction !== 'hold' && <Icon name={direction}/>}<span>{direction === 'hold' ? 'HOLD' : direction?.toUpperCase()}</span></span>;
}

function StashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m8 3 4 2 4-2-1 5c3 3 5 5 5 9 0 3-3 4-8 4s-8-1-8-4c0-4 2-6 5-9L8 3Zm1 5h6M9 12l3 2 3-2"/></svg>;
}

const movement = direction => direction === 'hold' ? 'hold this lane' : `move ${direction}`;

function Option({ direction, tone, icon, title, benefit, detail, cost, redundant = false }) {
  return <div className={`reward-option reward-option-${tone} ${redundant ? 'reward-option-redundant' : ''}`}>
    <div className="reward-option-heading"><Direction direction={direction}/><span>{title}</span></div>
    <b className="reward-option-benefit">{icon}{benefit}</b>
    <span className="reward-option-detail">{detail}</span>
    <small className="reward-option-cost">{cost}</small>
  </div>;
}

export default function RewardOpportunity({ choice }) {
  const wildlife = choice.family === 'wildlife-bank', detour = choice.family === 'landing-detour';
  const powerTaken = !!choice.counterpartCollected, taken = choice.collected || powerTaken;
  const boostDuration = choice.counterpartDuration ?? 8;
  const actionIcon = choice.action === 'jump' ? 'jump' : choice.action === 'duck' ? 'duck' : null;
  const action = choice.actionLabel ?? 'Dodge';
  const coinCount = choice.coinCount ?? 8;
  const opponentDirection = choice.opposingChoiceDirection ?? choice.counterpartDirection ?? choice.actionDirection;
  const title = wildlife ? 'COINS NOW OR CLEAN BONUS?' : detour ? 'POINTS NOW OR DOUBLE GOLD?' : 'POINTS OR PROTECTION?';
  const held = !!choice.heldShield || !!choice.shieldAlreadyHeld;
  const returnText = detour ? `Return ${movement(choice.returnDirection)}; ${action.toLowerCase()} the next guard.` : wildlife ? `After the pickup, ${movement(choice.returnDirection)}.` : `Cut back: ${movement(choice.returnDirection)} before the rock.`;
  const receipt = powerTaken ? detour ? `Gold ×2 · ${boostDuration}s collected` : choice.shieldAlreadyHeld ? 'Shield already held · no extra shield' : 'Shield collected' : wildlife ? `${coinCount} coins · +${Math.floor(choice.earned ?? 0)} points` : `+${choice.stashPoints} points collected`;
  const missed = powerTaken ? `Passed +${choice.stashPoints} points` : wildlife ? 'Guard skipped · clean bonus unavailable' : detour ? choice.activeBoost > 0 ? 'Skipped boost refresh' : `Passed ${boostDuration}s Gold Boost` : held ? 'Skipped duplicate shield' : 'Missed shield pickup';
  const accessible = taken ? `${receipt}. ${missed}. ${returnText}` : wildlife ?
    `${movement(choice.stashDirection)} for ${coinCount} actual coins, building streak and Rush, or ${movement(choice.actionDirection)} and ${action.toLowerCase()} for guarded gold and a perfect clear.${choice.cleanAtRisk > 0 ? ` The coin pouch bypasses the guard and loses the ${choice.cleanAtRisk}-point clean bonus.` : ' The clean bonus is already unavailable.'} After the guard, ${movement(choice.guardExitDirection)}; after the pouch, ${movement(choice.returnDirection)}.` : detour ?
    `${movement(choice.stashDirection)} for ${choice.stashPoints} fixed points, then ${movement(choice.returnDirection)} and ${action.toLowerCase()} the next guard; or ${movement(opponentDirection)} for Gold Boost, double touched-gold value for ${boostDuration} seconds. Both pickups are at the same distance; taking either misses the other.` :
    `${movement(choice.stashDirection)} for ${choice.stashPoints} fixed points and cut back ${movement(choice.returnDirection)} before the rock, or ${movement(opponentDirection)} into clear water for ${held ? 'a redundant shield; you already hold one, and shields do not stack' : 'one shield that absorbs one hit'}. Both pickups are at the same distance; taking either misses the other.`;
  const stash = <Option key="stash" direction={choice.stashDirection} tone="gold" icon={wildlife ? <Icon name="coin"/> : <StashIcon/>}
    title={wildlife ? 'COIN POUCH' : 'STASH'} benefit={wildlife ? `${coinCount} COINS` : `+${choice.stashPoints} POINTS`}
    detail={wildlife ? 'Build coin streak' : detour ? 'Return + next action' : 'Grab, then cut back'}
    cost={wildlife ? choice.cleanAtRisk > 0 ? `Lose clean +${choice.cleanAtRisk}` : 'Clean bonus unavailable' : detour ? choice.activeBoost > 0 ? 'Skip boost refresh' : 'Skip Gold Boost' : held ? 'Keep your held shield' : 'Skip shield pickup'}/>;
  const opposing = wildlife ? <Option key="action" direction={choice.actionDirection} tone="risk" icon={<Icon name={actionIcon}/>} title={action.toUpperCase()}
    benefit="GUARDED GOLD" detail={choice.cleanAtRisk > 0 ? `Keep clean +${choice.cleanAtRisk}` : 'Gold + perfect clear'} cost={`Give up ${coinCount}-coin pouch`}/>
    : <Option key="power" direction={opponentDirection} tone="power" icon={<Icon name={detour ? 'coin' : 'shield'}/>}
      redundant={!detour && held} title={detour ? 'GOLD BOOST' : 'CLEAR WATER'} benefit={detour ? `GOLD ×2 · ${boostDuration}s` : held ? 'SHIELD HELD' : '1 SHIELD'}
      detail={detour ? choice.activeBoost > 0 ? `Refresh boost to ${boostDuration}s` : 'Double gold you touch' : held ? 'No extra protection' : 'Absorbs one hit'}
      cost={`Give up +${choice.stashPoints} points`}/>;
  const options = choice.alternativeLane < choice.entryLane ? [stash, opposing] : [opposing, stash];
  return <div className={`reward-opportunity ${taken ? 'reward-opportunity-receipt' : ''}`} role="group" aria-label={accessible} data-choice-id={choice.id} data-choice-family={choice.family}>
    {taken ? <><div className="reward-receipt"><Icon name="check"/><b>{receipt}</b></div><small className="reward-receipt-cost">{missed}</small></> : <><h3>{title}</h3><div className="reward-options">{options}</div></>}
    <div className="reward-return-line">{wildlife && !taken ? <><span>After {action.toLowerCase()}</span><Direction direction={choice.guardExitDirection}/><span>· pouch</span><Direction direction={choice.returnDirection}/></> : <><span>{detour ? 'Return' : wildlife ? 'Next lane' : 'Cut back'}</span><Direction direction={choice.returnDirection}/>{detour && actionIcon && <><Icon name={actionIcon}/><b>{action.toUpperCase()}</b></>}</>}</div>
  </div>;
}
