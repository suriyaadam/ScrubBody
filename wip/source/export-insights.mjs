import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {products} from './src/data/products.js';
const files=['src/data/products.js','src/order.js','insights/data.js','insights/preview-data.js','insights/views.js','insights/app.js'];
const strip=source=>source.replace(/^import[\s\S]*?from\s+(['"])[^'"]+\1;[ \t]*(?:\r?\n)?/gm,'').replace(/\bexport (?=(?:const|function) )/g,'');
let script=(await Promise.all(files.map(async file=>strip(await readFile(file,'utf8'))))).join('\n');
for(const product of products.filter(p=>p.imageReady)){
 const bytes=await readFile('.'+product.image);
 const mime=product.image.endsWith('.webp')?'image/webp':'image/png';
 script=script.replaceAll(product.image,`data:${mime};base64,${bytes.toString('base64')}`);
}
let page=await readFile('insights/index.html','utf8');
const css=await readFile('insights/styles.css','utf8');
page=page.replace('<link rel="stylesheet" href="styles.css">',()=>`<style>${css}</style>`);
page=page.replace('<script type="module" src="app.js"></script>',()=>`<script type="module">${script.replaceAll('</script','<\\/script')}</script>`);
await mkdir('dist',{recursive:true});await writeFile('dist/insights.html',page);
console.log('ZÉMAYA INSIGHTS autonome : dist/insights.html');
