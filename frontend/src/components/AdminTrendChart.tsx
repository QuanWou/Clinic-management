import {useId} from 'react';

export type AdminTrendSeries={key:string;label:string;format?:(value:number)=>string};
export type AdminTrendPoint={label:string;[key:string]:string|number};

const formatNumber=(value:number)=>new Intl.NumberFormat('vi-VN').format(value);

export function AdminTrendChart({title,description,data,series,height=260,axisFormat=formatNumber}:{title:string;description:string;data:AdminTrendPoint[];series:AdminTrendSeries[];height?:number;axisFormat?:(value:number)=>string}){
 const id=useId(),width=760,pad={left:54,right:20,top:22,bottom:42};
 const chartW=width-pad.left-pad.right,chartH=height-pad.top-pad.bottom;
 const values=data.flatMap(point=>series.map(item=>Number(point[item.key]??0))).filter(Number.isFinite);
 const max=Math.max(1,...values);
 const y=(value:number)=>pad.top+chartH-(value/max)*chartH;
 const x=(index:number)=>data.length<=1?pad.left+chartW/2:pad.left+(index/(data.length-1))*chartW;
 const grid=[0,.25,.5,.75,1].map(ratio=>({ratio,value:max*(1-ratio),y:pad.top+chartH*ratio}));
 const palette=['var(--fresh-forest-800)','#7aa933','#c7922f','#6a7f70'];
 return <section className="admin-chart-card" aria-labelledby={id}>
  <div className="admin-chart-heading"><div><span className="eyebrow">BIỂU ĐỒ</span><h2 id={id}>{title}</h2><p>{description}</p></div><div className="admin-chart-legend">{series.map((item,index)=><span key={item.key}><i style={{background:palette[index%palette.length]}}/>{item.label}</span>)}</div></div>
  {!data.length?<div className="task-empty"><p>Chưa có dữ liệu cho biểu đồ.</p></div>:<div className="admin-chart-scroll"><svg className="admin-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
   {grid.map(line=><g key={line.ratio}><line x1={pad.left} x2={width-pad.right} y1={line.y} y2={line.y} className="admin-chart-grid"/><text x={pad.left-10} y={line.y+4} textAnchor="end" className="admin-chart-axis">{axisFormat(Math.round(line.value))}</text></g>)}
   <line x1={pad.left} x2={width-pad.right} y1={pad.top+chartH} y2={pad.top+chartH} className="admin-chart-axis-line"/>
   {data.map((point,index)=><text key={'label-'+index} x={x(index)} y={height-14} textAnchor="middle" className="admin-chart-axis">{String(point.label)}</text>)}
   {series.map((item,sIndex)=>{
    const points=data.map((point,index)=>`${x(index)},${y(Number(point[item.key]??0))}`).join(' ');
    return <g key={item.key}>
     <polyline points={points} fill="none" stroke={palette[sIndex%palette.length]} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
     {data.map((point,index)=>{const value=Number(point[item.key]??0);return <g key={index}><circle cx={x(index)} cy={y(value)} r="4" fill="#fff" stroke={palette[sIndex%palette.length]} strokeWidth="2"><title>{item.label}: {item.format?item.format(value):formatNumber(value)} · {point.label}</title></circle></g>;})}
    </g>;
   })}
  </svg></div>}
 </section>;
}

export function AdminBars({title,description,items}:{title:string;description:string;items:{label:string;value:number;format?:(value:number)=>string}[]}){
 const id=useId(),max=Math.max(1,...items.map(item=>item.value));
 return <section className="admin-chart-card admin-bars-card" aria-labelledby={id}>
  <div className="admin-chart-heading"><div><span className="eyebrow">CƠ CẤU</span><h2 id={id}>{title}</h2><p>{description}</p></div></div>
  <div className="admin-bars">{items.map(item=><div className="admin-bar-row" key={item.label}><div className="admin-bar-meta"><span>{item.label}</span><strong>{item.format?item.format(item.value):formatNumber(item.value)}</strong></div><div className="admin-bar-track" aria-hidden="true"><span style={{width:`${Math.max(item.value?4:0,(item.value/max)*100)}%`}}/></div></div>)}</div>
 </section>;
}
