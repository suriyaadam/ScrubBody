import http from 'node:http';
import {open,realpath} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {pipeline} from 'node:stream/promises';

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm'};

// A single byte range is enough for HTML video seeking, including Safari/iOS.
// Multipart ranges are deliberately rejected rather than returning incorrect bytes.
function parseRange(value,size){
  const match=/^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if(!match||(!match[1]&&!match[2])||size===0)return null;
  let start,end;
  if(!match[1]){
    const suffix=Number(match[2]);
    if(!Number.isSafeInteger(suffix)||suffix<=0)return null;
    start=Math.max(0,size-suffix);end=size-1;
  }else{
    start=Number(match[1]);
    end=match[2]?Number(match[2]):size-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return null;
    end=Math.min(end,size-1);
  }
  return {start,end};
}

function isWithinRoot(root,path){
  const part=relative(root,path);
  return part!==''&&!part.startsWith('..'+sep)&&part!=='..'&&!part.split(/[\\/]/).some(segment=>segment.startsWith('.'));
}

function errorResponse(req,res,status,message,headers={}){
  const body=Buffer.from(message);
  res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Content-Length':body.length,'X-Content-Type-Options':'nosniff',...headers});
  res.end(req.method==='HEAD'?undefined:body);
}

export function createStaticServer({root=process.cwd()}={}){
  // Resolve the serving root too, so a checkout mounted through a symlink works.
  const rootPath=realpath(resolve(root));
  return http.createServer(async(req,res)=>{
    let file;
    let streamOwnsFile=false;
    try{
      if(req.method!=='GET'&&req.method!=='HEAD'){
        errorResponse(req,res,405,'Méthode non autorisée',{'Allow':'GET, HEAD'});return;
      }
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname.includes('\0')){errorResponse(req,res,400,'Chemin invalide');return;}
      const servingRoot=await rootPath;
      const requested=resolve(servingRoot,'.'+(pathname==='/'?'/index.html':pathname));
      if(pathname.split(/[\\/]/).some(segment=>segment.startsWith('.'))||!isWithinRoot(servingRoot,requested)){
        errorResponse(req,res,403,'Accès interdit');return;
      }
      const path=await realpath(requested);
      if(!isWithinRoot(servingRoot,path)){
        errorResponse(req,res,403,'Accès interdit');return;
      }
      file=await open(path,'r');
      const stat=await file.stat();
      if(!stat.isFile()){errorResponse(req,res,404,'Ressource introuvable');return;}
      const headers={
        'Content-Type':mime[extname(path).toLowerCase()]||'application/octet-stream',
        'X-Content-Type-Options':'nosniff',
        'Accept-Ranges':'bytes',
        'Content-Length':stat.size,
        'Last-Modified':stat.mtime.toUTCString()
      };
      let range;
      // RFC 9110: Range applies to GET. HEAD returns full representation headers.
      if(req.method==='GET'&&req.headers.range){
        range=parseRange(req.headers.range,stat.size);
        if(!range){
          res.writeHead(416,{...headers,'Content-Range':`bytes */${stat.size}`,'Content-Length':0}).end();return;
        }
        headers['Content-Range']=`bytes ${range.start}-${range.end}/${stat.size}`;
        headers['Content-Length']=range.end-range.start+1;
      }
      res.writeHead(range?206:200,headers);
      if(req.method==='HEAD'||stat.size===0){res.end();return;}
      const stream=file.createReadStream(range?{start:range.start,end:range.end}:{});
      streamOwnsFile=true;
      await pipeline(stream,res);
    }catch(error){
      if(res.headersSent){res.destroy();return;}
      const status=error instanceof URIError?400:error.code==='EACCES'?403:404;
      errorResponse(req,res,status,status===400?'Chemin invalide':status===403?'Accès interdit':'Ressource introuvable');
    }finally{
      if(file&&!streamOwnsFile)await file.close().catch(()=>{});
    }
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const port=Number(process.env.PORT)||5173;
  createStaticServer().listen(port,'0.0.0.0',()=>console.log('ZÉMAYA : serveur démarré sur le port '+port));
}
