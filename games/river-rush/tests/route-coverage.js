import {isBranchSpan,branchLanes} from '../src/game/branch-spans.js';
export const coveredLanes=row=>[...new Set(row.flatMap(e=>isBranchSpan(e)?branchLanes(e):[e.lane]))].sort();
export const actionWall=row=>coveredLanes(row).length===3&&row.every(e=>e.type===row[0].type&&e.type!=='rock');
export const formation=row=>row.every(e=>e.type===row[0].type)?`${coveredLanes(row).length}:${row[0].type}`:'mixed';
