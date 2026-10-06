// World art follows course coordinates. It never participates in collisions.
export const DISTRICTS = ['CANOPY TRAIL', 'CASCADE CANYON', 'SUN TEMPLE HARBOR'];
export function recycleZ(offset,distance,length,origin=24) {
  return origin-((offset-distance)%length+length)%length;
}
export function bankHeightAt(x,course) {
  const across=Math.max(0,(Math.abs(x)-9)/34),z=-course-32,tau=Math.PI*2;
  return .24+Math.pow(across,.72)*8.5+Math.sin(z*tau/64)*Math.sin(across*4)*1.8+Math.sin(z*tau/16+across*19)*.55*across;
}
export function districtAt(distance) {
  const index=((Math.floor(distance/600)%3)+3)%3;
  return {index,name:DISTRICTS[index]};
}
export function scenerySlots(distance,view=205) {
  const first=Math.floor((distance-20)/32),last=Math.ceil((distance+view)/32),items=[];
  for(let n=first;n<=last;n++)for(const side of [-1,1]) {
    const course=n*32+(side===1?13:0),z=distance-course;
    if(z>18||z< -view)continue;
    const district=districtAt(course).index;
    // Open stretches between landmarks make each silhouette worth noticing.
    const kind=district===2&&Math.abs(n)%2===0?'harbor':'canopy';
    if(district===1&&Math.abs(n)%3===1)continue;
    items.push({n,side,course,z,district,kind,size:.82+(Math.abs(n)%4)*.09});
  }
  return items;
}
