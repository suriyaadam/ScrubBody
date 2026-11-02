import {products} from '../src/data/products.js';
import {DELIVERY_ZONES,PAYMENT_METHODS,normalizeDjiboutiPhone,createOrderId} from '../src/order.js';

export const INSIGHTS_STORAGE_KEY='zemaya-insights-orders-v1';
export const ORDER_STATUSES=Object.freeze([
  {id:'received',label:'Reçue'}, {id:'confirmed',label:'Confirmée'},
  {id:'preparing',label:'En préparation'}, {id:'delivering',label:'En livraison'},
  {id:'delivered',label:'Livrée'}, {id:'cancelled',label:'Annulée'}
].map(value=>Object.freeze(value)));
export const PAYMENT_STATUSES=Object.freeze([
  {id:'unpaid',label:'Non payée'}, {id:'paid',label:'Payée'}
].map(value=>Object.freeze(value)));
export const REGIONS=Object.freeze([...new Set(DELIVERY_ZONES.map(zone=>zone.city))].map(label=>Object.freeze({id:slug(label),label})));
const DAY=86400000;
const confirmedStatuses=new Set(['confirmed','preparing','delivering','delivered']);
const metricKeys=['revenue','received','confirmed','paidOrders','itemsSold','customers','averageBasket'];

function text(value){return typeof value==='string'?value.trim().replace(/\s+/g,' '):'';}
function slug(value){return text(value).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[\s_]+/g,'-');}
function searchText(value){return String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();}
function required(value,label,max=120){const result=text(value);if(!result||result.length>max)throw new Error(`${label} : renseignez un texte de 1 à ${max} caractères.`);return result;}
function amount(value,label){if(!Number.isSafeInteger(value)||value<0)throw new Error(`${label} : le montant doit être un entier positif ou nul en FDJ.`);return value;}
function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function isoDate(value){
  if(typeof value!=='string')throw new Error('La date de commande doit être une date ISO avec son fuseau horaire.');
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!match)throw new Error('La date de commande doit être une date ISO avec son fuseau horaire.');
  const [,year,month,day,hour,minute,second]=match;
  const daysInMonth=new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate();
  const parsed=new Date(value);
  if(Number(month)<1||Number(month)>12||Number(day)<1||Number(day)>daysInMonth||Number(hour)>23||Number(minute)>59||Number(second||0)>59||!Number.isFinite(parsed.getTime()))throw new Error('La date de commande est invalide.');
  return parsed.toISOString();
}
function normalizeItems(input){
  if(!Array.isArray(input)||input.length===0)throw new Error('Ajoutez au moins un article à la commande.');
  const seen=new Set();
  return input.map(item=>{
    if(!plain(item))throw new Error('Un article de la commande est invalide.');
    const productId=required(item.productId,'Référence produit',100);
    if(seen.has(productId))throw new Error(`La référence ${productId} apparaît plusieurs fois dans la commande.`);
    seen.add(productId);
    const name=required(item.name,'Nom du produit',200);
    if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>99)throw new Error('La quantité de chaque article doit être comprise entre 1 et 99.');
    const unitPrice=amount(item.unitPrice,'Prix unitaire');
    amount(unitPrice*item.quantity,'Total de l’article');
    return {productId,name,quantity:item.quantity,unitPrice};
  });
}

// Records are entered or imported by the operator. A WhatsApp link does not add one.
// Unit prices and delivery fees are historical snapshots, never replaced on load.
export function normalizeOrder(input){
  if(!plain(input))throw new Error('La commande doit être un objet.');
  const id=required(input.id,'Numéro de commande',100);
  if(/[\r\n\u0000-\u001f]/.test(input.id))throw new Error('Le numéro de commande contient des caractères invalides.');
  const createdAt=isoDate(input.createdAt);
  if(!plain(input.customer))throw new Error('Les coordonnées du client sont manquantes.');
  const phone=normalizeDjiboutiPhone(input.customer.phone);
  if(!phone)throw new Error('Le téléphone du client doit être un numéro djiboutien avec l’indicatif +253.');
  const zoneId=text(input.customer.zoneId);
  if(!DELIVERY_ZONES.some(zone=>zone.id===zoneId))throw new Error('La zone de livraison est inconnue.');
  const customer={name:required(input.customer.name,'Nom du client'),phone,zoneId,quarter:required(input.customer.quarter,'Quartier'),address:required(input.customer.address,'Adresse',500)};
  const items=normalizeItems(input.items);
  const paymentMethod=text(input.paymentMethod);
  if(!PAYMENT_METHODS.some(method=>method.id===paymentMethod))throw new Error('Le moyen de paiement est inconnu.');
  const status=text(input.status);
  if(!ORDER_STATUSES.some(value=>value.id===status))throw new Error('Le statut de commande est inconnu.');
  const paymentStatus=text(input.paymentStatus);
  if(!PAYMENT_STATUSES.some(value=>value.id===paymentStatus))throw new Error('Le statut de paiement est inconnu.');
  const shippingFee=amount(input.shippingFee,'Frais de livraison');
  if(input.notes!==undefined&&input.notes!==null&&typeof input.notes!=='string')throw new Error('Les notes doivent être un texte.');
  const notes=typeof input.notes==='string'?input.notes.replace(/\r\n?/g,'\n').trim():'';
  if(notes.length>1000)throw new Error('Les notes ne doivent pas dépasser 1 000 caractères.');
  const normalized={id,createdAt,customer,items,paymentMethod,status,paymentStatus,shippingFee,notes};
  orderTotals(normalized);
  return normalized;
}

export function orderTotals(order){
  const items=normalizeItems(order?.items);
  const subtotal=items.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0);
  amount(subtotal,'Sous-total');
  const shippingFee=amount(order.shippingFee,'Frais de livraison');
  const total=amount(subtotal+shippingFee,'Total');
  return {subtotal,shippingFee,total,quantity:items.reduce((sum,item)=>sum+item.quantity,0)};
}
function normalizeList(input){
  if(!Array.isArray(input))throw new Error('Les commandes doivent être présentées dans une liste.');
  const ids=new Set();
  return input.map((entry,index)=>{
    let order;
    try{order=normalizeOrder(entry);}catch(error){throw new Error(`Commande ${index+1} : ${error.message}`);}
    if(ids.has(order.id))throw new Error(`Le numéro ${order.id} apparaît plusieurs fois. Aucun enregistrement n’a été remplacé.`);
    ids.add(order.id);return order;
  });
}
function unpack(input){
  let value=input;
  if(typeof value==='string'){
    try{value=JSON.parse(value);}catch{throw new Error('Le fichier de commandes ne contient pas un JSON valide.');}
  }
  if(Array.isArray(value))return value;
  if(plain(value)&&value.version===1&&Array.isArray(value.orders))return value.orders;
  throw new Error('Format non reconnu : utilisez une liste de commandes ou un export de version 1.');
}

export function loadOrders(storage){
  let raw;
  try{raw=storage.getItem(INSIGHTS_STORAGE_KEY);}catch{throw new Error('Le stockage local est inaccessible. Vos données n’ont pas été modifiées.');}
  if(raw===null||raw===undefined)return [];
  try{return normalizeList(unpack(raw));}catch(error){throw new Error(`Les données locales ne peuvent pas être lues : ${error.message} Elles ont été conservées.`);}
}
export function saveOrders(storage,orders){
  const normalized=normalizeList(orders);
  const payload=JSON.stringify({version:1,orders:normalized});
  try{storage.setItem(INSIGHTS_STORAGE_KEY,payload);}catch{throw new Error('Impossible d’enregistrer les commandes dans ce navigateur. Vérifiez l’espace disponible et les autorisations de stockage.');}
  return normalized;
}
function fingerprint(order){return JSON.stringify({...order,items:[...order.items].sort((a,b)=>a.productId.localeCompare(b.productId))});}
export function importOrders(existing,input){
  const merged=normalizeList(existing);
  const byId=new Map(merged.map(order=>[order.id,order]));
  const incoming=unpack(input).map((entry,index)=>{
    try{return normalizeOrder(entry);}catch(error){throw new Error(`Import, commande ${index+1} : ${error.message}`);}
  });
  for(const order of incoming){
    const previous=byId.get(order.id);
    if(previous){if(fingerprint(previous)!==fingerprint(order))throw new Error(`La commande ${order.id} existe avec des informations différentes. L’import a été annulé sans modifier vos données.`);continue;}
    byId.set(order.id,order);merged.push(order);
  }
  return merged;
}

export function createManualOrder(fields,items){
  if(!plain(fields))throw new Error('Renseignez les informations de commande.');
  if(!Array.isArray(items))throw new Error('Ajoutez au moins un article à la commande.');
  const customer=fields.customer||{name:fields.name,phone:fields.phone,zoneId:fields.zoneId,quarter:fields.quarter,address:fields.address};
  const zone=DELIVERY_ZONES.find(value=>value.id===customer.zoneId);
  const entries=items.map(item=>{
    const product=products.find(value=>value.id===item.productId);
    return {...item,name:item.name??product?.name,unitPrice:item.unitPrice??product?.price};
  });
  return normalizeOrder({id:fields.id||createOrderId(),createdAt:fields.createdAt||new Date().toISOString(),customer,items:entries,paymentMethod:fields.paymentMethod,status:fields.status||'received',paymentStatus:fields.paymentStatus||'unpaid',shippingFee:fields.shippingFee??zone?.fee,notes:fields.notes||''});
}

function nowDate(value){const result=value===Date||value===undefined?new Date():new Date(value);if(!Number.isFinite(result.getTime()))throw new Error('La date de référence est invalide.');return result;}
function utcFloor(value){const date=new Date(value);return new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));}
function boundary(value){
  if(value===null||value===undefined||value==='')return null;
  if(typeof value==='string'&&value.includes('T'))return new Date(isoDate(value)).getTime();
  if(typeof value==='string'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('La période sélectionnée doit utiliser des dates au format ISO.');
  const parsed=new Date(value);
  if(!Number.isFinite(parsed.getTime())||(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&parsed.toISOString().slice(0,10)!==value))throw new Error('La période sélectionnée contient une date invalide.');
  return parsed.getTime();
}
export function getDateRange(period='30',now=new Date(),custom={}){
  const today=utcFloor(nowDate(now));
  let end=today.getTime()+DAY,start;
  const key=String(period);
  if(key==='all')return {start:null,end:null,previousStart:null,previousEnd:null};
  if(['7','30','90','365'].includes(key))start=end-Number(key)*DAY;
  else if(key==='today'||key==='day')start=today.getTime();
  else if(key==='week'){start=today.getTime()-((today.getUTCDay()+6)%7)*DAY;}
  else if(key==='month')start=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1);
  else if(key==='year')start=Date.UTC(today.getUTCFullYear(),0,1);
  else if(key==='custom'){
    start=boundary(custom.start);end=boundary(custom.end);
    if(typeof custom.end==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(custom.end))end+=DAY;
    if(start===null||end===null)throw new Error('Choisissez une date de début et une date de fin.');
  }else throw new Error('La période sélectionnée est inconnue.');
  if(end<=start)throw new Error('La fin de période doit suivre son début.');
  return {start:new Date(start).toISOString(),end:new Date(end).toISOString(),previousStart:new Date(start-(end-start)).toISOString(),previousEnd:new Date(start).toISOString()};
}
function matchesFilters(order,options){
  const start=boundary(options.start),end=boundary(options.end);
  const timestamp=new Date(order.createdAt).getTime();
  if((start!==null&&timestamp<start)||(end!==null&&timestamp>=end))return false;
  if(options.region&&options.region!=='all'){
    const zone=DELIVERY_ZONES.find(item=>item.id===order.customer.zoneId);
    if(slug(options.region)!==slug(zone.city)&&options.region!==order.customer.zoneId)return false;
  }
  for(const key of ['status','paymentStatus','paymentMethod'])if(options[key]&&options[key]!=='all'&&order[key]!==options[key])return false;
  const query=searchText(text(options.query));
  if(query){
    const haystack=searchText([order.id,order.customer.name,order.customer.phone,order.customer.quarter,order.customer.address,...order.items.map(item=>item.name)].join(' '));
    if(!haystack.includes(query))return false;
  }
  return true;
}
export function filterOrders(orders,options={}){
  const start=boundary(options.start),end=boundary(options.end);
  if(start!==null&&end!==null&&end<=start)throw new Error('La fin de période doit suivre son début.');
  return normalizeList(orders).filter(order=>matchesFilters(order,options)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
}
function paid(order){return order.paymentStatus==='paid'&&order.status!=='cancelled';}
function kpis(orders){
  const paidOrders=orders.filter(paid);
  const revenue=paidOrders.reduce((sum,order)=>sum+orderTotals(order).subtotal,0);
  return {revenue,received:orders.length,confirmed:orders.filter(order=>confirmedStatuses.has(order.status)).length,paidOrders:paidOrders.length,itemsSold:paidOrders.reduce((sum,order)=>sum+orderTotals(order).quantity,0),customers:new Set(orders.map(order=>order.customer.phone)).size,averageBasket:paidOrders.length?revenue/paidOrders.length:null};
}
function bucketStart(timestamp,granularity){
  const date=utcFloor(timestamp);
  if(granularity==='week')date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
  else if(granularity==='month')date.setUTCDate(1);
  else if(granularity==='year'){date.setUTCMonth(0);date.setUTCDate(1);}
  return date;
}
function nextBucket(date,granularity){const next=new Date(date);if(granularity==='week')next.setUTCDate(next.getUTCDate()+7);else if(granularity==='month')next.setUTCMonth(next.getUTCMonth()+1);else if(granularity==='year')next.setUTCFullYear(next.getUTCFullYear()+1);else next.setUTCDate(next.getUTCDate()+1);return next;}
function bucketLabel(date,granularity){return new Intl.DateTimeFormat('fr-FR',{timeZone:'UTC',...(granularity==='year'?{year:'numeric'}:granularity==='month'?{month:'short',year:'numeric'}:{day:'2-digit',month:'short',year:'numeric'})}).format(date);}
function series(orders,options,now){
  let start=boundary(options.start),end=boundary(options.end);
  if(start===null&&orders.length)start=orders.reduce((min,order)=>Math.min(min,new Date(order.createdAt).getTime()),Infinity);
  if(end===null&&orders.length)end=utcFloor(orders.reduce((max,order)=>Math.max(max,new Date(order.createdAt).getTime()),-Infinity)).getTime()+DAY;
  if(start===null||end===null)return [];
  const days=(end-start)/DAY;
  const granularity=options.granularity||((days<=31)?'day':days<=180?'week':days<=730?'month':'year');
  if(!['day','week','month','year'].includes(granularity))throw new Error('Choisissez un regroupement par jour, semaine, mois ou année.');
  const buckets=new Map();
  for(let date=bucketStart(start,granularity);date.getTime()<end;date=nextBucket(date,granularity)){
    if(buckets.size>=10000)throw new Error('Cette période est trop longue pour le regroupement choisi. Sélectionnez une vue plus large.');
    const key=date.toISOString();
    buckets.set(key,{key,label:bucketLabel(date,granularity),start:key,revenue:0,orders:0,paidOrders:0,itemsSold:0});
  }
  for(const order of orders){
    const key=bucketStart(new Date(order.createdAt).getTime(),granularity).toISOString();
    const point=buckets.get(key);if(!point)continue;
    point.orders++;
    if(paid(order)){const totals=orderTotals(order);point.revenue+=totals.subtotal;point.paidOrders++;point.itemsSold+=totals.quantity;}
  }
  return [...buckets.values()];
}

export function getAnalytics(orders,options={},now=new Date()){
  nowDate(now);
  const filteredOrders=filterOrders(orders,options);
  const start=boundary(options.start),end=boundary(options.end);
  const comparable=start!==null&&end!==null&&end>start;
  const previousOptions=comparable?{...options,start:new Date(start-(end-start)).toISOString(),end:new Date(start).toISOString()}:null;
  const previousOrders=previousOptions?filterOrders(orders,previousOptions):[];
  const currentKpis=kpis(filteredOrders),previousKpis=kpis(previousOrders);
  const growth=Object.fromEntries(metricKeys.map(key=>[key,comparable&&previousKpis[key]>0&&currentKpis[key]!==null?(currentKpis[key]-previousKpis[key])/previousKpis[key]*100:null]));
  const regions=REGIONS.map(region=>{
    const matching=filteredOrders.filter(order=>slug(DELIVERY_ZONES.find(zone=>zone.id===order.customer.zoneId).city)===region.id);
    const metrics=kpis(matching);return {...region,orders:metrics.received,revenue:metrics.revenue,paidOrders:metrics.paidOrders};
  }).sort((a,b)=>b.orders-a.orders||a.label.localeCompare(b.label));
  const popular=new Map();
  for(const order of filteredOrders.filter(paid))for(const item of order.items){const result=popular.get(item.productId)||{productId:item.productId,name:item.name,quantity:0,revenue:0};result.quantity+=item.quantity;result.revenue+=item.quantity*item.unitPrice;popular.set(item.productId,result);}
  const popularProducts=[...popular.values()].sort((a,b)=>b.quantity-a.quantity||b.revenue-a.revenue||a.name.localeCompare(b.name));
  const payments=PAYMENT_METHODS.map(method=>{const matching=filteredOrders.filter(order=>order.paymentMethod===method.id);const metrics=kpis(matching);return {id:method.id,label:method.label,count:matching.length,paidCount:metrics.paidOrders,revenue:metrics.revenue};});
  return {orders:filteredOrders,filteredOrders,kpis:currentKpis,previousKpis,growth,timeSeries:series(filteredOrders,options,now),regions,popularProducts,payments};
}
