"""Technical review labels only; never synthesize or alter source geometry."""
from pathlib import Path
import subprocess,json,math,os
os.environ["MAGICK_THREAD_LIMIT"]="4"
O=Path(__file__).resolve().parent
FONT='/usr/share/fonts/liberation/LiberationSans-Regular.ttf'
views=json.loads((O/'Ownership.json').read_text())['source_views']
probes=json.loads((O.parent/'TripoTopknotBagRepair-v1/NextProposal/ContactProbes.json').read_text())['probes']
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def sub(a,b):return [x-y for x,y in zip(a,b)]
def norm(a):return [x/math.sqrt(dot(a,a)) for x in a]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def run(args):subprocess.run(['magick',*map(str,args)],check=True)
notes={
 'contact-A':'A | vertex 18459 | PALE CONNECTOR / CLOTH UNRESOLVED',
 'contact-B':'B | vertex 38348 | FIX SHIRT; BAG-SIDE FAN KNOWN',
 'contact-D':'D | vertex 18478 | NAVY BAG / SHORTS UNRESOLVED',
 'hidden-back-high':'HIDDEN | FOREARM, THUMB, BACKING OWNERSHIP UNRESOLVED',
 'hidden-under':'UNDERSIDE / NO BACKING FACES ASSUMED OR CREATED'}
out={}
for name,location,aim,scale in views:
    point=None
    if name.startswith('contact-'):
        letter=name[-1];probe=next(v for k,v in probes.items() if k.startswith(letter+'_'))
        direction=norm(sub(aim,location));right=norm(cross(direction,[0,0,1]));up=cross(right,direction)
        delta=sub(probe['world_m'],location)
        point=((dot(delta,right)/(scale*600/720)+.5)*600,(.5-dot(delta,up)/scale)*720)
        out[name]={'raw_vertex_id':probe['vertex_id'],'pixel_in_original':point,'world_m':probe['world_m']}
    for mode in ('original','clay','mask','seam'):
        args=[O/(name+'-'+mode+'.png')]
        if point:
            x,y=point
            args+=['-fill','none','-stroke','#ffffff','-strokewidth','4','-draw',f'circle {x},{y} {x+10},{y}',
                '-stroke','#e91e63','-strokewidth','2','-draw',f'circle {x},{y} {x+10},{y}',
                '-draw',f'line {x-17},{y} {x+17},{y} line {x},{y-17} {x},{y+17}']
        title=notes.get(name,name.upper()+' / PROPOSAL ONLY')
        args+=['-background','#172331','-gravity','north','-splice','0x64','-font',FONT,'-fill','white','-pointsize','14',
            '-stroke','none','-gravity','northwest','-annotate','+9+8',title+'\n'+mode.upper()+' | Proposal only | RED = UNREVIEWED candidate contact',
            O/(name+'-'+mode+'-annotated.png')]
        run(args)
def sheet(name,viewnames):
    files=[O/(v+'-'+m+'-annotated.png') for v in viewnames for m in ('original','clay','mask','seam')]
    run(['montage',*files,'-tile','4x'+str(len(viewnames)),'-geometry','600x784+3+3','-background','#172331',O/(name+'.png')])
sheet('Contacts-A-B-D',['contact-A','contact-B','contact-D'])
sheet('HiddenContacts',['hidden-back-high','hidden-under'])
sheet('FullViews',['front','left','back','right'])
sheet('AssemblyViews',['bag-front','bag-back','strap-front'])
for name in ('contact-A','contact-B','contact-D'):
    run(['montage',*[O/(name+'-'+m+'-annotated.png') for m in ('original','clay')],'-tile','2x1','-geometry','600x784+3+3','-background','#172331',O/(name+'-SourceClay.png')])
(O/'ContactPixels.json').write_text(json.dumps(out,indent=2)+'\n')
print('ANNOTATED_PROPOSAL_VIEWS_READY')
