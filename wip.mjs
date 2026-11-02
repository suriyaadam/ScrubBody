import {cp,lstat,mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,relative,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const project=process.cwd();
const output=resolve(project,'wip');
const downloads=resolve(project,'downloads');
const archive=join(downloads,'zemaya-wip.zip');
const marker='.zemaya-wip-generated.json';
const owner='zemaya-wip-v1';
const sourceFiles=['index.html','package.json','server.mjs','scripts.mjs','export.mjs','wip.mjs','README.md','PUBLICATION.md','WIP.md','src','public','tests','assets-source','review','insights','export-insights.mjs'];
const optional=new Set(['README.md','PUBLICATION.md','WIP.md','assets-source','review','insights','export-insights.mjs']);
const excluded=new Set(['node_modules','dist','wip','downloads','__pycache__','coverage']);

async function exists(path){try{return await lstat(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function digest(bytes){return createHash('sha256').update(bytes).digest('hex');}
async function inventory(folder){
  const files={};
  async function visit(path){
    for(const entry of await readdir(path,{withFileTypes:true})){
      const full=join(path,entry.name);
      const name=relative(folder,full).split(sep).join('/');
      if(name===marker)continue;
      if(entry.isSymbolicLink())throw new Error(`Lien symbolique refusé dans le dossier généré : ${name}`);
      if(entry.isDirectory()){files[name+'/']='directory';await visit(full);}
      else if(entry.isFile())files[name]=digest(await readFile(full));
      else throw new Error(`Type de fichier non pris en charge : ${name}`);
    }
  }
  await visit(folder);
  return files;
}
async function verifyPrevious(){
  const stat=await exists(output);
  if(!stat)return false;
  if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Le chemin wip existe sans être un dossier généré. Aucun fichier n’a été remplacé.');
  let saved;
  try{saved=JSON.parse(await readFile(join(output,marker),'utf8'));}catch{throw new Error('Le dossier wip existe sans marqueur valide. Déplacez-le avant de relancer ; il a été conservé.');}
  if(saved.owner!==owner||!saved.files||Array.isArray(saved.files))throw new Error('Le marqueur du dossier wip est inconnu. Le dossier a été conservé.');
  const current=await inventory(output);
  if(Object.keys(current).length!==Object.keys(saved.files).length||Object.entries(current).some(([name,hash])=>saved.files[name]!==hash)){
    throw new Error('Le dossier wip contient des ajouts ou des modifications. Conservez ces fichiers ailleurs avant de régénérer ; aucun fichier n’a été remplacé.');
  }
  return true;
}
function canCopy(path){
  const parts=relative(project,path).split(sep);
  return !parts.some(part=>part.startsWith('.')||excluded.has(part)||/^(?:credentials?|secrets?|id_rsa|id_ed25519)(?:\..*)?$/i.test(part)||/\.(?:pem|key|p12|pfx)$/i.test(part));
}
async function copySource(from,to){
  const stat=await lstat(from);
  if(stat.isSymbolicLink())throw new Error(`Lien symbolique refusé dans les sources : ${relative(project,from)}`);
  if(stat.isDirectory()){
    await mkdir(to,{recursive:true});
    for(const name of await readdir(from)){
      const child=join(from,name);
      if(canCopy(child))await copySource(child,join(to,name));
    }
  }else if(stat.isFile())await cp(from,to);
  else throw new Error(`Type de source non pris en charge : ${relative(project,from)}`);
}

const previous=await verifyPrevious();
const downloadsStat=await exists(downloads);
if(downloadsStat&&(!downloadsStat.isDirectory()||downloadsStat.isSymbolicLink()))throw new Error('Le chemin downloads doit être un dossier réel.');
const archiveStat=await exists(archive);
if(archiveStat&&(!previous||!archiveStat.isFile()||archiveStat.isSymbolicLink()))throw new Error('Une archive non identifiée existe déjà. Elle a été conservée.');
const standalone=resolve(project,'dist/zemaya.html');
if(!(await exists(standalone))?.isFile())throw new Error('Export autonome absent : lancez npm run export avant node wip.mjs.');
const stage=await mkdtemp(join(tmpdir(),'zemaya-wip-'));
try{
  const stagedOutput=join(stage,'wip');
  await mkdir(join(stagedOutput,'source'),{recursive:true});
  await cp(standalone,join(stagedOutput,'index.html'));
  await mkdir(join(stagedOutput,'insights'),{recursive:true});
  await cp(join(project,'dist/insights.html'),join(stagedOutput,'insights/index.html'));
  for(const name of sourceFiles){
    const path=join(project,name);
    if(!(await exists(path))){if(optional.has(name))continue;throw new Error(`Source nécessaire absente : ${name}`);}
    await copySource(path,join(stagedOutput,'source',name));
  }
  const reviewLinks=[];
  for(const [name,label] of [['desktop-final.png','Vue ordinateur'],['mobile-final.png','Vue téléphone']]){
    if((await exists(join(stagedOutput,'source','review',name)))?.isFile())reviewLinks.push(`- [${label}](source/review/${name})`);
  }
  const reviewSection=reviewLinks.length?'\n\n## Captures vérifiées\n\n'+reviewLinks.join('\n'):'';
  await writeFile(join(stagedOutput,'README.md'),`# ZÉMAYA — version en cours\n\nOuvrez index.html dans votre navigateur pour consulter le site autonome : les images et la vidéo disponibles au moment de l’export sont incluses. Aucun serveur n’est nécessaire pour cette consultation.\n\nPour consulter ZÉMAYA INSIGHTS, ouvrez insights/index.html. Ses données sont enregistrées uniquement dans ce navigateur ; le mode de prévisualisation est distinct et explicitement fictif.\n\nPour modifier le projet, installez Node.js 22 ou ultérieur, ouvrez un terminal dans source/, puis lancez npm run dev. Le serveur utilise le port 5173. Les sources sont utilisables sans installation de dépendances.\n\nLe panier fonctionne côté navigateur. Les demandes de commande sont préparées pour WhatsApp : le client doit lui-même appuyer sur Envoyer, puis attendre la confirmation de la boutique. Le formulaire de contact et les paiements ne sont pas raccordés. Aucun paiement ni aucune confirmation de commande ne sont produits automatiquement. Les informations commerciales et juridiques doivent être complétées avant ouverture.\n\nLa lecture liée au défilement nécessite une vidéo fournie et un navigateur compatible ; les réglages de réduction des animations sont respectés.\n\nCe dossier est généré depuis les sources du projet. Conservez vos modifications dans une copie séparée avant de le régénérer.${reviewSection}\n`);
  const files=await inventory(stagedOutput);
  await writeFile(join(stagedOutput,marker),JSON.stringify({owner,files},null,2)+'\n');
  const stagedArchive=join(stage,'zemaya-wip.zip');
  const zipped=spawnSync('zip',['-q','-r',stagedArchive,'wip'],{cwd:stage,encoding:'utf8',maxBuffer:1024*1024});
  if(zipped.error)throw new Error(`Impossible de créer l’archive : ${zipped.error.message}`);
  if(zipped.status!==0)throw new Error(`Échec de zip : ${zipped.stderr||zipped.stdout}`);
  // Recheck just before replacing: never discard edits made during staging.
  // Only our verified generated directory and the named archive are replaced.
  if(previous){await verifyPrevious();await rm(output,{recursive:true});}
  await cp(stagedOutput,output,{recursive:true});
  await mkdir(downloads,{recursive:true});
  await cp(stagedArchive,archive);
  console.log('Dossier prêt : wip/ ; archive prête : downloads/zemaya-wip.zip');
}finally{
  await rm(stage,{recursive:true,force:true});
}
