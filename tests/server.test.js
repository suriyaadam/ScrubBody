import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStaticServer} from '../server.mjs';

// Exercise real HTTP responses and exact bytes, not just range-parser arithmetic.
test('serveur vidéo : flux, plages HTTP, HEAD et protection des chemins',async t=>{
  const folder=await mkdtemp(join(tmpdir(),'zemaya-range-'));
  const root=join(folder,'public');await mkdir(root);
  const bytes=Buffer.from(Array.from({length:256},(_,i)=>i));
  await writeFile(join(root,'film.mp4'),bytes);
  await writeFile(join(root,'film.webm'),bytes);
  await writeFile(join(root,'index.html'),'<h1>ZÉMAYA</h1>');
  await writeFile(join(root,'empty.mp4'),'');
  await writeFile(join(root,'.env'),'must-not-be-served');
  await writeFile(join(folder,'outside.txt'),'private');
  await symlink(join(folder,'outside.txt'),join(root,'escape.txt'));
  await symlink(join(root,'.env'),join(root,'hidden.txt'));
  const server=createStaticServer({root});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true});});

  await t.test('GET complet et types vidéo',async()=>{
    for(const [file,type] of [['film.mp4','video/mp4'],['film.webm','video/webm']]){
      const response=await fetch(base+'/'+file);
      assert.equal(response.status,200);
      assert.equal(response.headers.get('content-type'),type);
      assert.equal(response.headers.get('accept-ranges'),'bytes');
      assert.equal(response.headers.get('content-length'),'256');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
    }
  });
  await t.test('plages fermées, ouvertes, suffixes et bornes',async()=>{
    for(const [header,start,end] of [['bytes=0-1',0,1],['bytes=64-127',64,127],['bytes=250-',250,255],['bytes=-8',248,255],['bytes=250-999',250,255],['bytes=-999',0,255]]){
      const response=await fetch(base+'/film.mp4',{headers:{Range:header}});
      assert.equal(response.status,206,header);
      assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/256`);
      assert.equal(response.headers.get('content-length'),String(end-start+1));
      assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(start,end+1));
    }
  });
  await t.test('plages impossibles et malformed : 416',async()=>{
    for(const header of ['bytes=256-','bytes=20-10','bytes=-0','bytes=-','bytes=0-1,4-5','bytes=abc-def','bytes=9007199254740993-']){
      const response=await fetch(base+'/film.mp4',{headers:{Range:header}});
      assert.equal(response.status,416,header);
      assert.equal(response.headers.get('content-range'),'bytes */256');
      assert.equal((await response.arrayBuffer()).byteLength,0);
    }
    const empty=await fetch(base+'/empty.mp4',{headers:{Range:'bytes=0-'}});
    assert.equal(empty.status,416);assert.equal(empty.headers.get('content-range'),'bytes */0');
  });
  await t.test('HEAD : en-têtes complets sans corps, Range ignoré',async()=>{
    const response=await fetch(base+'/film.mp4',{method:'HEAD',headers:{Range:'bytes=0-1'}});
    assert.equal(response.status,200);assert.equal(response.headers.get('content-length'),'256');
    assert.equal(response.headers.get('content-range'),null);
    assert.equal((await response.arrayBuffer()).byteLength,0);
  });
  await t.test('racine, fichiers vides, méthodes et chemins protégés',async()=>{
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await fetch(base+'/empty.mp4')).status,200);
    for(const path of ['/.env','/escape.txt','/hidden.txt','/src/.env'])assert.equal((await fetch(base+path)).status,403,path);
    assert.equal((await fetch(base+'/absent.mp4')).status,404);
    const post=await fetch(base+'/film.mp4',{method:'POST'});assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET, HEAD');
  });
});
