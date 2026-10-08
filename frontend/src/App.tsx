import {AsyncPanel} from './components/AsyncPanel';
import {resolveSurface,resolveUiState} from './routing';
import {SessionProvider,useLocation,useSession} from './auth/SessionProvider';
import {WorkspaceLoginPage} from './auth/LoginPage';
import {loginUrl} from './auth/returnTo';
import {lazy,useEffect,useState} from 'react';

const PublicShell=lazy(()=>import('./shells/PublicShell').then(m=>({default:m.PublicShell})));
const WorkspaceShell=lazy(()=>import('./shells/WorkspaceShell').then(m=>({default:m.WorkspaceShell})));
const CustomerPaymentDisplay=lazy(()=>import('./components/CustomerPaymentDisplay').then(m=>({default:m.CustomerPaymentDisplay})));

function Application(){
 const locationKey=useLocation();
 const [publicName,setPublicName]=useState('Phòng khám');
 const auth=useSession()!;
 const pathname=window.location.pathname;
 const current=pathname+window.location.search+window.location.hash;
 const surface=resolveSurface(pathname);
 const state=resolveUiState(window.location.search);
 const patientProtected=pathname.startsWith('/tai-khoan')||pathname==='/public/account';

 useEffect(()=>{
  if(pathname==='/platform'){auth.navigate('/workspace?view=system',true);return;}
  if(pathname==='/login'||pathname==='/dang-nhap'){auth.navigate('/public/login'+window.location.search,true);return;}
  if(pathname==='/dang-ky'){auth.navigate('/public/register'+window.location.search,true);return;}
  if(auth.ready&&(surface==='workspace'||surface==='platform')&&pathname!=='/workspace/login'&&!auth.workspaceSession){
   auth.navigate(loginUrl('workspace',current),true);return;
  }
  if(auth.ready&&patientProtected&&!auth.patientSession){
   auth.navigate(loginUrl('patient',current),true);
  }
 },[locationKey,auth.ready,auth.workspaceSession?.token,auth.patientSession?.token]);

 if(pathname.startsWith('/payment-display/')){const token=decodeURIComponent(pathname.slice('/payment-display/'.length));return <CustomerPaymentDisplay token={token||'error'}/>;}
 if(pathname==='/platform'||pathname==='/login'||pathname==='/dang-nhap'||pathname==='/dang-ky')return null;
 if(((surface==='workspace'||surface==='platform')||patientProtected)&&!auth.ready)return null;
 if(pathname==='/workspace/login')return <WorkspaceLoginPage brandName={publicName}/>;
 if((surface==='workspace'||surface==='platform')&&!auth.workspaceSession)return null;
 if(patientProtected&&!auth.patientSession)return null;
 if(surface==='workspace'||surface==='platform')return <WorkspaceShell key={auth.workspaceSession!.actor.userId} state={state}/>;
 return <PublicShell key={auth.publicVersion} state={state} onSiteName={setPublicName}/>;
}
export function App(){return <SessionProvider><AsyncPanel><Application/></AsyncPanel></SessionProvider>;}
