export type Power = 'flame'|'zeus'|'ares'|'poseidon'|'artemis'|'hermes'|'athena'|'demeter';
export const blessings: {id:Power;god:string;name:string;description:string;color:string;symbol:string}[] = [
{id:'flame',god:'PROMETHEUS',name:'Living flame',description:'Stronger fire. Gain a second shot at rank III.',color:'#ffa65f',symbol:'♨'},
{id:'zeus',god:'ZEUS',name:'Chain lightning',description:'Lightning jumps between nearby enemies.',color:'#b5d9ff',symbol:'ϟ'},
{id:'ares',god:'ARES',name:'Blades of war',description:'Spinning blades cut a path around you.',color:'#f79a91',symbol:'⚔'},
{id:'poseidon',god:'POSEIDON',name:'Tidal pulse',description:'A wave pushes enemies back and damages them.',color:'#78e8d0',symbol:'Ψ'},
{id:'artemis',god:'ARTEMIS',name:'Silver hunt',description:'Piercing arrows seek the nearest enemy.',color:'#d7e7aa',symbol:'☽'},
{id:'hermes',god:'HERMES',name:'Winged steps',description:'Move 6.5% faster. Gather souls from farther away.',color:'#e9ce83',symbol:'➶'},
{id:'athena',god:'ATHENA',name:'Aegis',description:'Take 5.5% less damage. Restore 15 health now.',color:'#e8d9b4',symbol:'◇'},
{id:'demeter',god:'DEMETER',name:'Winter’s embrace',description:'Nearby enemies slow down inside a frost circle.',color:'#a0dbe9',symbol:'❄'},
];
export const encounterNames:Record<string,string>={swarm:'The restless dead',rush:'Serpents of the Styx',elite:'Bronze guardians',recovery:'Persephone’s mercy',mixed:'Hades calls his legions'};
export const realms = ['THE FIELDS OF ASPHODEL','THE RIVER STYX','THE GATES OF TARTARUS'];
