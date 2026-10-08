import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/dung0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const directory = path.dirname(fileURLToPath(import.meta.url));
const diagrams = JSON.parse(fs.readFileSync(path.join(directory, 'diagrams.json'), 'utf8'));
const colour = '#c79818';
const pale = '#fff4cc';
const escapeXml = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const colourText = '#17212f';
function wrap(text, max=25) {
  return text.split('\n').flatMap(line => {
    const words=line.split(' '), output=[];let part='';
    for(const word of words){if(part && (part+' '+word).length>max){output.push(part);part=word;}else part+=(part?' ':'')+word;}
    if(part)output.push(part);return output;
  });
}
function text(cx,cy,lines,size=18,weight='normal',italic=false) {
  const step=size*1.22;
  return '<text x="'+cx+'" y="'+(cy-(lines.length-1)*step/2+size*.34)+'" text-anchor="middle" font-family="Arial, sans-serif" font-size="'+size+'" font-weight="'+weight+'" font-style="'+(italic?'italic':'normal')+'" fill="'+colourText+'">'+lines.map((line,i)=>'<tspan x="'+cx+'" dy="'+(i?step:0)+'">'+escapeXml(line)+'</tspan>').join('')+'</text>';
}
function figure(cx,cy,label) {
  return '<g fill="none" stroke="'+colour+'" stroke-width="2"><circle cx="'+cx+'" cy="'+(cy-46)+'" r="14"/><path d="M '+cx+' '+(cy-32)+' V '+(cy+14)+' M '+(cx-28)+' '+(cy-15)+' H '+(cx+28)+' M '+cx+' '+(cy+14)+' L '+(cx-24)+' '+(cy+47)+' M '+cx+' '+(cy+14)+' L '+(cx+24)+' '+(cy+47)+'"/></g>'+text(cx,cy+78,wrap(label,22),18);
}
let drawioPages=[];
let manifest=[];
let thumbnails=[];
for(let dIndex=0;dIndex<diagrams.length;dIndex++){
  const d=diagrams[dIndex];
  const n=d.children.length;
  const firstY=d.children.some(c=>(c.includes||[]).length>1)?320:250;
  const ys=d.children.map((_,i)=>firstY+i*132);
  const parentY=(ys[0]+ys[n-1])/2;
  const helpers=new Map();
  d.children.forEach((c,i)=>(c.includes||[]).forEach(label=>{
    if(!helpers.has(label))helpers.set(label,{label,sources:[]});
    helpers.get(label).sources.push(i);
  }));
  let helperCounter=0;
  for(const helper of helpers.values()){
    helper.id='helper-'+helperCounter++;
    helper.y=helper.sources.reduce((sum,i)=>sum+ys[i],0)/helper.sources.length;
  }
  // Multiple mandatory steps belonging to the same source have separate rows.
  d.children.forEach((c,i)=>{
    const own=(c.includes||[]).map(label=>helpers.get(label)).filter(h=>h.sources.length===1);
    own.forEach((h,j)=>h.y=ys[i]+(j-(own.length-1)/2)*108);
  });
  const hasHelpers=helpers.size>0;
  const width=hasHelpers?1550:(d.secondary?1550:1290);
  const right=hasHelpers?1500:(d.secondary?1170:1240);
  const bottom=Math.max(ys[n-1]+94,...[...helpers.values()].map(h=>h.y+74),620);
  const height=bottom+155;
  const nodes=[];
  const edges=[];
  const labels=[];
  const addNode=(id,label,x,y,w,h,type='ellipse',extra={})=>nodes.push({id,label,x,y,w,h,type,...extra});
  addNode('actor',d.actor,80,parentY-65,70,110,'actor');
  addNode('parent',d.title,330,parentY-58,320,116,'ellipse',{abstract:d.mode==='abstract'});
  d.children.forEach((c,i)=>addNode('child-'+i,c.label,825,ys[i]-44,300,88));
  for(const helper of helpers.values())addNode(helper.id,helper.label,1230,helper.y-44,250,88);
  const parentPoint=childY=>{
    const dy=childY-parentY;
    const dx=335;
    const scale=1/Math.sqrt((dx/160)**2+(dy/58)**2);
    return {x:490+dx*scale,y:parentY+dy*scale};
  };
  edges.push({source:'actor',target:'parent',kind:'association',points:[{x:150,y:parentY},{x:330,y:parentY}]});
  d.children.forEach((c,i)=>{
    const pp=parentPoint(ys[i]);
    const toChild=[pp,{x:735,y:ys[i]},{x:825,y:ys[i]}];
    const fromChild=[...toChild].reverse();
    edges.push({source:c.relation==='include'?'parent':'child-'+i,target:c.relation==='include'?'child-'+i:'parent',kind:c.relation,points:c.relation==='include'?toChild:fromChild});
    if(c.relation!=='generalization'){
      labels.push({id:'label-'+i,x:670,y:ys[i]-(c.condition?43:29),w:153,h:c.condition?42:25,lines:[c.relation==='include'?'«include»':'«extend»',...(c.condition?wrap('['+c.condition+']',24):[])]});
    }
    (c.includes||[]).forEach(label=>{
      const helper=helpers.get(label);
      edges.push({source:'child-'+i,target:helper.id,kind:'include',points:[{x:1125,y:ys[i]},{x:1178,y:ys[i]},{x:1230,y:helper.y}]});
      labels.push({id:'helper-label-'+i+'-'+helper.id,x:1122,y:ys[i]-31,w:110,h:25,lines:['«include»']});
    });
  });
  if(d.secondary){
    const index=d.secondary.child;
    const y=ys[index];
    addNode('secondary',d.secondary.actor,1380,y-65,70,110,'actor');
    edges.push({source:'secondary',target:'child-'+index,kind:'association',points:[{x:1380,y},{x:1125,y}]});
  }
  let svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><defs><marker id="open" markerWidth="13" markerHeight="13" refX="11" refY="6" orient="auto"><path d="M 1 1 L 11 6 L 1 11" fill="none" stroke="'+colour+'" stroke-width="1.4"/></marker><marker id="generalization" markerWidth="18" markerHeight="16" refX="15" refY="8" orient="auto"><path d="M 1 1 L 15 8 L 1 15 Z" fill="white" stroke="'+colour+'" stroke-width="1.3"/></marker></defs><rect width="'+width+'" height="'+height+'" fill="white"/>';
  svg+=text(width/2,38,wrap('Hình '+String(dIndex+1).padStart(2,'0')+' — '+d.title,65),25,'bold');
  svg+='<rect x="245" y="83" width="'+(right-245)+'" height="49" rx="5" fill="#fafafa" stroke="#d5d9df"/>';
  svg+=text((245+right)/2,108,wrap('Tiền điều kiện: '+d.pre,100),15);
  svg+='<rect x="245" y="153" width="'+(right-245)+'" height="'+(bottom-153)+'" rx="3" fill="white" stroke="#9ca3af" stroke-width="1.3"/>';
  svg+=text((245+right)/2,178,['HỆ THỐNG QUẢN LÝ PHÒNG KHÁM'],16,'bold');
  for(const e of edges){
    const dPath=e.points.map((p,i)=>(i?'L ':'M ')+p.x+' '+p.y).join(' ');
    const marker=e.kind==='association'?'':(e.kind==='generalization'?' marker-end="url(#generalization)"':' marker-end="url(#open)"');
    svg+='<path d="'+dPath+'" fill="none" stroke="'+colour+'" stroke-width="1.35"'+(e.kind==='include'||e.kind==='extend'?' stroke-dasharray="6 5"':'')+marker+'/>';
  }
  for(const node of nodes){
    if(node.type==='actor'){svg+=figure(node.x+node.w/2,node.y+65,node.label);continue;}
    const cx=node.x+node.w/2,cy=node.y+node.h/2;
    svg+='<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+node.w/2+'" ry="'+node.h/2+'" fill="'+pale+'" stroke="'+colour+'" stroke-width="1.45"/>';
    const content=wrap(node.label,node.id==='parent'?27:27);
    if(node.abstract)svg+=text(cx,cy-35,['«abstract»'],13);
    svg+=text(cx,cy+(node.abstract?7:0),content,node.id==='parent'?20:18,'normal',node.abstract);
  }
  for(const label of labels){
    const h=Math.max(label.h,label.lines.length*17);
    svg+='<rect x="'+label.x+'" y="'+label.y+'" width="'+label.w+'" height="'+h+'" fill="white"/>';
    svg+=text(label.x+label.w/2,label.y+h/2,label.lines,14);
  }
  d.notes.forEach((note,i)=>svg+=text(width/2,bottom+29+i*25,wrap(note,130),14));
  svg+=text(width/2,height-25,[d.mode==='abstract'?'Tam giác rỗng: chuyên biệt hóa mục tiêu | Nét đứt: include / extend có điều kiện':'Nét đứt: include (bắt buộc) / extend (bổ sung theo điều kiện)'],13);
  svg+='</svg>';
  fs.writeFileSync(path.join(directory,d.id+'.svg'),svg,'utf8');
  await sharp(Buffer.from(svg)).resize({width:width*2}).png().toFile(path.join(directory,d.id+'.png'));
  const thumb=await sharp(Buffer.from(svg)).resize({width:420}).png().toBuffer();
  thumbnails.push({input:thumb,top:Math.floor(dIndex/3)*360+44,left:(dIndex%3)*440+10});
  manifest.push({id:d.id,title:d.title,width,height,children:n,mode:d.mode});
  const ellipseStyle='ellipse;whiteSpace=wrap;html=0;fillColor='+pale+';strokeColor='+colour+';fontColor='+colourText+';fontFamily=Arial;fontSize=18;spacing=8;';
  const textStyle='text;html=0;whiteSpace=wrap;align=center;verticalAlign=middle;fillColor=white;strokeColor=none;fontFamily=Arial;fontColor='+colourText+';';
  const xmlNode=(id,value,x,y,w,h,style,parent='1')=>'<mxCell id="'+id+'" value="'+escapeXml(value).replaceAll('\n','&#xa;')+'" style="'+style+'" vertex="1" parent="'+parent+'"><mxGeometry x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" as="geometry"/></mxCell>';
  let cells='<mxCell id="0"/><mxCell id="1" parent="0"/>';
  cells+=xmlNode('boundary','',245,153,right-245,bottom-153,'rounded=0;fillColor=white;strokeColor=#9ca3af;');
  cells+=xmlNode('title','Hình '+String(dIndex+1).padStart(2,'0')+' — '+d.title,30,12,width-60,52,textStyle+'fontSize=25;fontStyle=1;');
  cells+=xmlNode('precondition','Tiền điều kiện: '+d.pre,245,83,right-245,49,'rounded=1;whiteSpace=wrap;html=0;fillColor=#fafafa;strokeColor=#d5d9df;fontSize=15;fontFamily=Arial;');
  cells+=xmlNode('system-name','HỆ THỐNG QUẢN LÝ PHÒNG KHÁM',250,159,right-255,35,textStyle+'fontSize=16;fontStyle=1;');
  for(const node of nodes){
    const style=node.type==='actor'?'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=0;whiteSpace=wrap;strokeColor='+colour+';fillColor=none;fontColor='+colourText+';fontFamily=Arial;fontSize=18;':ellipseStyle+(node.abstract?'fontStyle=2;':'');
    cells+=xmlNode(node.id,(node.abstract?'«abstract»\n':'')+node.label,node.x,node.y,node.w,node.h,style);
  }
  edges.forEach((e,i)=>{
    const marker=e.kind==='association'?'endArrow=none;':e.kind==='generalization'?'endArrow=block;endFill=0;endSize=15;':'endArrow=open;endFill=0;endSize=10;dashed=1;dashPattern=6 5;';
    const first=e.points[0],last=e.points[e.points.length-1];
    const points=e.points.slice(1,-1).map(p=>'<mxPoint x="'+p.x+'" y="'+p.y+'"/>').join('');
    cells+='<mxCell id="edge-'+i+'" value="" style="edgeStyle=none;rounded=0;html=0;strokeColor='+colour+';strokeWidth=1.35;'+marker+'" edge="1" parent="1" source="'+e.source+'" target="'+e.target+'"><mxGeometry relative="1" as="geometry"><mxPoint x="'+first.x+'" y="'+first.y+'" as="sourcePoint"/><mxPoint x="'+last.x+'" y="'+last.y+'" as="targetPoint"/><Array as="points">'+points+'</Array></mxGeometry></mxCell>';
  });
  labels.forEach(l=>cells+=xmlNode(l.id,l.lines.join('\n'),l.x,l.y,l.w,Math.max(l.h,l.lines.length*17),textStyle+'fontSize=14;'));
  d.notes.forEach((note,i)=>cells+=xmlNode('note-'+i,note,25,bottom+16+i*25,width-50,26,textStyle+'fontSize=14;'));
  cells+=xmlNode('legend',d.mode==='abstract'?'Tam giác rỗng: chuyên biệt hóa mục tiêu | Nét đứt: include / extend có điều kiện':'Nét đứt: include (bắt buộc) / extend (bổ sung theo điều kiện)',25,height-43,width-50,30,textStyle+'fontSize=13;');
  drawioPages.push('<diagram id="'+d.id+'" name="'+String(dIndex+1).padStart(2,'0')+'. '+escapeXml(d.title)+'"><mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="'+width+'" pageHeight="'+height+'" math="0" shadow="0"><root>'+cells+'</root></mxGraphModel></diagram>');
}
fs.writeFileSync(path.join(directory,'usecase-chi-tiet.drawio'),'<mxfile host="app.diagrams.net" type="device" compressed="false" version="24.7.17">'+drawioPages.join('')+'</mxfile>','utf8');
fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2),'utf8');
const contactHeight=Math.ceil(diagrams.length/3)*360+64;
const contactTitle=Buffer.from('<svg width="1320" height="42"><rect width="1320" height="42" fill="white"/>'+text(660,22,['18 SƠ ĐỒ USE CASE CHI TIẾT — CLINIC MANAGEMENT'],21,'bold')+'</svg>');
await sharp({create:{width:1320,height:contactHeight,channels:4,background:'white'}}).composite([{input:contactTitle,top:0,left:0},...thumbnails]).png().toFile(path.join(directory,'00-tong-hop.png'));
console.log(JSON.stringify({diagrams:diagrams.length,pages:drawioPages.length,output:directory}));

