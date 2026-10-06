import { AsyncPanel } from './components/AsyncPanel';
import { resolveSurface, resolveUiState } from "./routing";
import {SessionProvider,useLocation,useSession} from './auth/SessionProvider';
import {LoginPage} from './auth/LoginPage';
import {lazy,useEffect,useState} from 'react';

const PublicShell = lazy(() => import('./shells/PublicShell').then(m => ({default: m.PublicShell})));
const WorkspaceShell = lazy(() => import('./shells/WorkspaceShell').then(m => ({default: m.WorkspaceShell})));

function Application() {
  const locationKey=useLocation();
  const [publicName,setPublicName]=useState('Phòng khám');
  const auth=useSession()!;
  useEffect(()=>{if(window.location.pathname==='/platform')auth.navigate('/workspace?view=system',true);},[locationKey]);
  let publicLogin=false;
  if(['/login','/dang-nhap','/dang-ky'].includes(window.location.pathname)){
    const params=new URLSearchParams(window.location.search);
    const canonicalPublic=window.location.pathname==='/dang-nhap'||window.location.pathname==='/dang-ky';
    const area=canonicalPublic?'public':params.get('area');
    if(area==='public')publicLogin=true;
    return <LoginPage key={window.location.pathname} area={area==='public'?'public':'workspace'} registerMode={window.location.pathname==='/dang-ky'?true:undefined} brandName={publicName}/>;
  }
  const surface = resolveSurface(window.location.pathname);
  const state = resolveUiState(window.location.search);

  if (surface === "workspace" || surface === "platform") return auth.session?<WorkspaceShell key={auth.session.actor.userId} state={state} />:<LoginPage area="workspace"/>;
  return <><div hidden={publicLogin} inert={publicLogin||undefined}><PublicShell key={auth.publicVersion} state={state} background={publicLogin} onSiteName={setPublicName}/></div>{publicLogin&&<LoginPage area="public" brandName={publicName}/>}</>;
}
export function App(){return <SessionProvider><AsyncPanel><Application/></AsyncPanel></SessionProvider>;}
