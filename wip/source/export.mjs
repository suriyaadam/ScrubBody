import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {products} from './src/data/products.js';
import {heroMedia} from './src/data/hero-media.js';

const asDataUri=async (assetPath)=>{
 const extension=assetPath.split('.').pop().toLowerCase();
 const mime={png:'image/png',webp:'image/webp',jpg:'image/jpeg',mp4:'video/mp4',webm:'video/webm'}[extension];
 if(!mime||!assetPath.startsWith('/public/')||assetPath.includes('..'))throw new Error(`Chemin de média non pris en charge : ${assetPath}`);
 return `data:${mime};base64,${(await readFile('.'+assetPath)).toString('base64')}`;
};
let page=await readFile('index.html','utf8');
const css=await readFile('src/styles.css','utf8');
const sourcePaths=['src/data/products.js','src/data/hero-media.js','src/cart.js','src/hero-media.js','src/app.js'];
const sources=await Promise.all(sourcePaths.map(async path=>(await readFile(path,'utf8')).replace(/^import .*;\s*$/gm,'').replace(/\bexport (?=(?:const|function) )/g,'')));
if(heroMedia.frameCount&&heroMedia.framePattern&&heroMedia.mobileFramePattern){
 const embeddedFrames={};
 for(const [variant,pattern] of [['desktop',heroMedia.framePattern],['mobile',heroMedia.mobileFramePattern]]){
  embeddedFrames[variant]=await Promise.all(Array.from({length:heroMedia.frameCount},(_,index)=>asDataUri(pattern.replace('{index}',String(index+1).padStart(3,'0')))));
 }
 sources[1]+=`\nheroMedia.embeddedFrames=${JSON.stringify(embeddedFrames)};\n`;
}
let script=sources.join('\n');
const media=new Set(products.filter(p=>p.imageReady).map(p=>p.image));
for(const path of [heroMedia.videoSrc,heroMedia.poster,heroMedia.reducedMotionPoster])if(path)media.add(path);
for(const path of media)script=script.replaceAll(path,await asDataUri(path));
page=page.replace('<link rel="stylesheet" href="/src/styles.css">',()=>`<style>${css}</style>`);
page=page.replace('<script type="module" src="/src/app.js"></script>',()=>`<script type="module">${script.replaceAll('</script','<\\/script')}</script>`);
await mkdir('dist',{recursive:true});
await writeFile('dist/zemaya.html',page);
console.log('Site autonome avec ses médias : dist/zemaya.html');
