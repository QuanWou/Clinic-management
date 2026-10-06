export function SourceSessionState({error,retry}:{error?:string;retry:()=>void}){
 return <div className="source-session-state" role={error?'alert':'status'}>{error?<><p>Chưa mở được dữ liệu nghiệp vụ. Đối chiếu lại quyền hoặc kết nối để tiếp tục.</p><button className="button-secondary" onClick={retry}>Thử tải lại dữ liệu</button></>:<p>Đang mở dữ liệu phòng khám…</p>}</div>;
}
