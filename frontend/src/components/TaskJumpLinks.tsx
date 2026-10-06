export function TaskJumpLinks({label,items}:{label:string;items:{id:string;name:string}[]}){
 return <nav className="task-jump-links" aria-label={label}>{items.map(item=><a key={item.id} href={'#'+item.id} onClick={event=>{
  const target=document.getElementById(item.id);if(!target)return;
  event.preventDefault();target.focus({preventScroll:true});target.scrollIntoView({block:'start'});
 }}>{item.name}</a>)}</nav>;
}
