import { PlatformShell } from "./shells/PlatformShell";
import { PublicShell } from "./shells/PublicShell";
import { WorkspaceShell } from "./shells/WorkspaceShell";
import { resolveSurface, resolveUiState } from "./routing";
import {SessionProvider,useLocation,useSession} from './auth/SessionProvider';
import {LoginPage} from './auth/LoginPage';
import {useState} from 'react';

function Application() {
  useLocation();
  const [publicName,setPublicName]=useState('Phòng khám');
  const auth=useSession()!;
  let publicLogin=false;
  if(window.location.pathname==='/login'){
    const area=new URLSearchParams(window.location.search).get('area');
    if(area==='public')publicLogin=true;
    else return <LoginPage key={area} area={area==='platform'?area:'workspace'}/>;
  }
  const surface = resolveSurface(window.location.pathname);
  const state = resolveUiState(window.location.search);

  if (surface === "workspace") return auth.session?<WorkspaceShell key={auth.session.actor.userId} state={state} />:<LoginPage area="workspace"/>;
  if (surface === "platform") return auth.session?<PlatformShell key={auth.session.actor.userId} state={state} />:<LoginPage area="platform"/>;
  return <><div hidden={publicLogin} inert={publicLogin||undefined}><PublicShell key={auth.publicVersion} state={state} background={publicLogin} onSiteName={setPublicName}/></div>{publicLogin&&<LoginPage area="public" brandName={publicName}/>}</>;
}
export function App(){return <SessionProvider><Application/></SessionProvider>;}
