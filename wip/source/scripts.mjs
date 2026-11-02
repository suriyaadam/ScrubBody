import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');for(const path of ['index.html','src','public','insights'])await cp(path,'dist/'+path,{recursive:true});console.log('Site compilé dans dist/ (modules JavaScript natifs).');
