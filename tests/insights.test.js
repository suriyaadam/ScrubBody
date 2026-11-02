import {test} from 'node:test';
import assert from 'node:assert/strict';
import {INSIGHTS_STORAGE_KEY,ORDER_STATUSES,PAYMENT_STATUSES,REGIONS,normalizeOrder,orderTotals,createManualOrder,loadOrders,saveOrders,importOrders,filterOrders,getDateRange,getAnalytics} from '../insights/data.js';

// Synthetic unit-test records only. Production starts with no orders.
function record(id,createdAt='2026-11-02T10:00:00.000Z',overrides={}){
  return {id,createdAt,customer:{name:'Client de test',phone:'+25377123456',zoneId:'hodan',quarter:'Quartier de test',address:'Adresse de test'},items:[{productId:'papaye',name:'Papaye historique',quantity:1,unitPrice:350}],paymentMethod:'d-money',status:'received',paymentStatus:'unpaid',shippingFee:0,notes:'',...overrides};
}
function storage(initial){let value=initial===undefined?null:initial;return {getItem(key){assert.equal(key,INSIGHTS_STORAGE_KEY);return value;},setItem(key,next){assert.equal(key,INSIGHTS_STORAGE_KEY);value=next;},raw(){return value;}};}
const now=new Date('2026-11-02T14:30:00.000Z');

test('modèle strict, prix historiques et total distinct des frais',()=>{
  const original=record('A','2026-10-31T13:00:00+03:00',{items:[{productId:'ancienne-reference',name:'Ancienne référence',quantity:3,unitPrice:425}],shippingFee:777});
  const normalized=normalizeOrder(original);
  assert.equal(normalized.createdAt,'2026-10-31T10:00:00.000Z');
  assert.equal(normalized.items[0].unitPrice,425);assert.equal(normalized.shippingFee,777);
  assert.deepEqual(orderTotals(normalized),{subtotal:1275,shippingFee:777,total:2052,quantity:3});
  original.items[0].quantity=9;assert.equal(normalized.items[0].quantity,3);
  assert.equal(ORDER_STATUSES.length,6);assert.equal(PAYMENT_STATUSES.length,2);assert.equal(REGIONS.length,6);
});
test('rejet des dates impossibles, coordonnées, tarifs et statuts invalides',()=>{
  for(const createdAt of ['2026-02-30T10:00:00Z','2026-11-02T25:00:00Z','2026-11-02','date invalide'])assert.throws(()=>normalizeOrder(record('A',createdAt)),/date/i);
  for(const unitPrice of [-1,1.5,'350',NaN,Infinity])assert.throws(()=>normalizeOrder(record('A',undefined,{items:[{productId:'a',name:'Produit',quantity:1,unitPrice}]})),/montant/);
  for(const quantity of [0,-1,1.5,100,'2'])assert.throws(()=>normalizeOrder(record('A',undefined,{items:[{productId:'a',name:'Produit',quantity,unitPrice:350}]})),/quantité/);
  for(const [key,value] of [['status','pending'],['paymentStatus','automatic-paid'],['paymentMethod','card'],['shippingFee',-1],['items',[]]])assert.throws(()=>normalizeOrder(record('A',undefined,{[key]:value})));
  assert.throws(()=>normalizeOrder(record('A',undefined,{customer:{...record('A').customer,zoneId:'ailleurs'}})),/zone/);
  assert.throws(()=>normalizeOrder(record('A',undefined,{customer:{...record('A').customer,phone:'+221778682456'}})),/téléphone/);
  assert.throws(()=>normalizeOrder(record('A',undefined,{items:[...record('A').items,...record('A').items]})),/plusieurs fois/);
  assert.throws(()=>normalizeOrder(record('A',undefined,{notes:'a'.repeat(1001)})),/notes/);
});
test('saisie manuelle : catalogue actuel à la création, non payée par défaut',()=>{
  const result=createManualOrder({createdAt:now.toISOString(),customer:record('A').customer,paymentMethod:'cac-bank'},[{productId:'papaye',quantity:2}]);
  assert.match(result.id,/^ZEM-/);assert.equal(result.status,'received');assert.equal(result.paymentStatus,'unpaid');assert.equal(result.items[0].unitPrice,350);assert.equal(orderTotals(result).subtotal,700);
});
test('stockage vide, sauvegarde validée et chargement des données réelles seulement',()=>{
  const local=storage();assert.deepEqual(loadOrders(local),[]);
  const saved=saveOrders(local,[record('A')]);assert.deepEqual(loadOrders(local),saved);assert.equal(JSON.parse(local.raw()).version,1);
  assert.equal(saved[0].paymentStatus,'unpaid');
  const before=local.raw();assert.throws(()=>saveOrders(local,[record('A'),record('A')]));assert.equal(local.raw(),before);
});
test('JSON corrompu, version inconnue et pannes de stockage préservent les données',()=>{
  for(const raw of ['{cassé',JSON.stringify({version:99,orders:[]}),JSON.stringify([record('A'),record('A')])]){
    const local=storage(raw);assert.throws(()=>loadOrders(local),/conservées/);assert.equal(local.raw(),raw);
  }
  assert.throws(()=>loadOrders({getItem(){throw Error('blocked');}}),/inaccessible/);
  assert.throws(()=>saveOrders({setItem(){throw Error('quota');}},[record('A')]),/Impossible d’enregistrer/);
});
test('import atomique, doublons identiques ignorés et conflit sans mutation',()=>{
  const existing=[record('A')];const original=JSON.stringify(existing);
  assert.equal(importOrders(existing,JSON.stringify({version:1,orders:[record('A'),record('B')]})).length,2);
  assert.equal(importOrders([], [record('A'),record('A')]).length,1);
  assert.throws(()=>importOrders(existing,[record('B'),record('A',undefined,{status:'confirmed'})]),/import a été annulé/);
  assert.equal(JSON.stringify(existing),original);
  assert.throws(()=>importOrders(existing,[record('B'),record('C',undefined,{shippingFee:-1})]));assert.equal(JSON.stringify(existing),original);
  const twoItems=record('D',undefined,{items:[{productId:'a',name:'A',quantity:1,unitPrice:100},{productId:'b',name:'B',quantity:2,unitPrice:200}]});
  assert.equal(importOrders([twoItems],[{...twoItems,items:[...twoItems.items].reverse()}]).length,1);
});
test('périodes glissantes UTC, bornes exclusives et calendrier',()=>{
  for(const days of ['7','30','90','365']){
    const range=getDateRange(days,now);assert.equal(range.end,'2026-11-03T00:00:00.000Z');
    assert.equal((new Date(range.end)-new Date(range.start))/86400000,Number(days));
    assert.equal(new Date(range.previousEnd).getTime(),new Date(range.start).getTime());
    assert.equal(new Date(range.start)-new Date(range.previousStart),new Date(range.end)-new Date(range.start));
  }
  assert.equal(getDateRange('today',now).start,'2026-11-02T00:00:00.000Z');
  assert.equal(getDateRange('week',now).start,'2026-11-02T00:00:00.000Z');
  assert.equal(getDateRange('month',now).start,'2026-11-01T00:00:00.000Z');
  assert.equal(getDateRange('year',now).start,'2026-01-01T00:00:00.000Z');
  assert.deepEqual(getDateRange('all',now),{start:null,end:null,previousStart:null,previousEnd:null});
  const custom=getDateRange('custom',now,{start:'2026-11-01',end:'2026-11-02'});assert.equal(custom.start,'2026-11-01T00:00:00.000Z');assert.equal(custom.end,'2026-11-03T00:00:00.000Z');
  assert.throws(()=>getDateRange('custom',now,{start:'2026-02-30',end:'2026-03-01'}));
  assert.throws(()=>getDateRange('custom',now,{start:'11/01/2026',end:'11/02/2026'}));
  assert.throws(()=>getDateRange('custom',now,{start:'2026-11-05',end:'2026-11-01'}));
});
test('filtres aux bornes exactes, recherche accents et regroupement Djibouti-ville',()=>{
  const hodan=record('A','2026-11-01T00:00:00Z',{customer:{...record('A').customer,name:'Aïcha de test'}});
  const city=record('B','2026-11-02T23:59:59Z',{customer:{...record('A').customer,zoneId:'djibouti-ville'}});
  const outside=record('C','2026-11-03T00:00:00Z',{customer:{...record('A').customer,zoneId:'arta'}});
  const options={start:'2026-11-01T00:00:00Z',end:'2026-11-03T00:00:00Z'};
  assert.deepEqual(filterOrders([hodan,city,outside],options).map(item=>item.id),['B','A']);
  assert.equal(filterOrders([hodan,city,outside],{region:'djibouti-ville'}).length,2);
  assert.equal(filterOrders([hodan,city,outside],{region:'hodan'}).length,1);
  assert.equal(filterOrders([hodan,city,outside],{query:'aicha'}).length,1);
  assert.equal(filterOrders([hodan,city,outside],{query:'77123456'}).length,3);
});
test('KPI : CA produits payés hors annulations, quantités et clients uniques',()=>{
  const records=[
    record('paid','2026-11-01T10:00:00Z',{status:'delivered',paymentStatus:'paid',shippingFee:1000,items:[{productId:'papaye',name:'Papaye',quantity:2,unitPrice:350}]}),
    record('unpaid','2026-11-02T10:00:00Z',{status:'confirmed',shippingFee:500,customer:{...record('A').customer,phone:'+25377223344'}}),
    record('cancelled','2026-11-02T11:00:00Z',{status:'cancelled',paymentStatus:'paid',items:[{productId:'papaye',name:'Papaye',quantity:9,unitPrice:350}]}),
    record('received','2026-11-02T12:00:00Z')
  ];
  const analytics=getAnalytics(records,{start:'2026-11-01',end:'2026-11-03',granularity:'day'},now);
  assert.deepEqual(analytics.kpis,{revenue:700,received:4,confirmed:2,paidOrders:1,itemsSold:2,customers:2,averageBasket:700});
  assert.equal(analytics.popularProducts[0].quantity,2);assert.equal(analytics.popularProducts[0].revenue,700);
  assert.deepEqual(analytics.timeSeries.map(point=>point.revenue),[700,0]);
  assert.equal(analytics.payments.find(method=>method.id==='d-money').count,4);assert.equal(analytics.payments.find(method=>method.id==='d-money').paidCount,1);
});
test('croissance période précédente égale : croissance réelle, base zéro et moyenne absente',()=>{
  const previous=record('before','2026-10-31T10:00:00Z',{status:'delivered',paymentStatus:'paid'});
  const current=record('current','2026-11-02T10:00:00Z',{status:'delivered',paymentStatus:'paid',items:[{productId:'papaye',name:'Papaye',quantity:3,unitPrice:350}]});
  const options={start:'2026-11-01',end:'2026-11-03'};
  const data=getAnalytics([previous,current],options,now);
  assert.equal(data.kpis.revenue,1050);assert.equal(data.previousKpis.revenue,350);assert.equal(data.growth.revenue,200);assert.equal(data.growth.received,0);
  assert.equal(getAnalytics([current],options,now).growth.revenue,null);
  assert.equal(getAnalytics([previous],options,now).growth.revenue,-100);
  assert.equal(getAnalytics([previous],options,now).kpis.averageBasket,null);
  assert.equal(getAnalytics([previous],options,now).growth.averageBasket,null);
  assert.equal(getAnalytics([previous,current],{},now).growth.revenue,null);
});
test('géographie à six villes, classement produits et moyens choisis distincts des paiements',()=>{
  const records=[
    record('A',undefined,{status:'confirmed',paymentStatus:'paid',paymentMethod:'cac-bank',items:[{productId:'cafe',name:'Café ancien',quantity:2,unitPrice:425}]}),
    record('B',undefined,{status:'received',paymentMethod:'cash-on-delivery',customer:{...record('A').customer,zoneId:'djibouti-ville'}}),
    record('C',undefined,{status:'cancelled',paymentStatus:'paid',customer:{...record('A').customer,zoneId:'arta'}})
  ];
  const data=getAnalytics(records,{},now);const city=data.regions.find(region=>region.id==='djibouti-ville');
  assert.equal(data.regions.length,6);assert.equal(city.orders,2);assert.equal(city.revenue,850);
  assert.deepEqual(data.popularProducts,[{productId:'cafe',name:'Café ancien',quantity:2,revenue:850}]);
  const cash=data.payments.find(method=>method.id==='cash-on-delivery');assert.equal(cash.count,1);assert.equal(cash.paidCount,0);assert.equal(cash.revenue,0);
});
test('séries par jour, semaine du lundi, mois, année et aucun revenu inventé',()=>{
  const order=record('A','2026-11-02T10:00:00Z',{paymentStatus:'paid',status:'confirmed'});
  for(const [granularity,key] of [['day','2026-11-02'],['week','2026-11-02'],['month','2026-11-01'],['year','2026-01-01']]){
    const data=getAnalytics([order],{start:'2026-11-01',end:'2026-11-04',granularity},now);
    const point=data.timeSeries.find(value=>value.revenue===350);assert.ok(point.key.startsWith(key));
    assert.equal(data.timeSeries.reduce((sum,value)=>sum+value.revenue,0),350);
  }
  const empty=getAnalytics([],getDateRange('7',now),now);assert.equal(empty.kpis.revenue,0);assert.equal(empty.kpis.received,0);assert.equal(empty.kpis.averageBasket,null);assert.ok(Object.values(empty.growth).every(value=>value===null));assert.equal(empty.timeSeries.length,7);assert.ok(empty.timeSeries.every(point=>point.revenue===0));
});
