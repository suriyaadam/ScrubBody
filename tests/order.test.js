import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WHATSAPP_NUMBER,DELIVERY_ZONES,PAYMENT_METHODS,calculateOrder,normalizeDjiboutiPhone,validateCustomer,createOrderId,buildWhatsAppMessage,buildWhatsAppUrl} from '../src/order.js';
const fields={name:'  Aïcha  Ahmed ',phone:'+253 77 12 34 56',zoneId:'djibouti-ville',quarter:'  Plateau du Serpent  ',address:'Rue 12, maison 8',payment:'d-money',notes:'Près de l’école 🌿\nSonnez à la porte.'};

test('les sept tarifs de livraison et le total de deux produits sont exacts',()=>{
  assert.equal(DELIVERY_ZONES.length,7);
  for(const [id,fee] of [['hodan',0],['djibouti-ville',500],['ali-sabieh',1000],['tadjourah',1000],['dikhil',1000],['obock',1000],['arta',1000]]){
    const order=calculateOrder({papaye:2},id);
    assert.equal(order.subtotal,700);assert.equal(order.count,2);assert.equal(order.shippingFee,fee);assert.equal(order.total,700+fee);assert.equal(order.zone.id,id);
    assert.equal(order.discountSubtotal,0);assert.equal(order.discountProducts,0);assert.equal(order.taxes,0);
  }
  assert.equal(calculateOrder({papaye:2},'djibouti-ville').total,1200);
});
test('prix de chaque produit, panier mixte et quantités non valides',()=>{
  const catalog=[{id:'a',name:'Papaye',price:350},{id:'b',name:'Café',price:700}];
  const order=calculateOrder({a:2,b:3,inconnu:99},'arta',catalog);
  assert.deepEqual(order.items,[{id:'a',name:'Papaye',quantity:2,unitPrice:350,lineTotal:700},{id:'b',name:'Café',quantity:3,unitPrice:700,lineTotal:2100}]);
  assert.equal(order.subtotal,2800);assert.equal(order.total,3800);assert.equal(order.count,5);
  for(const quantity of [0,-1,1.5,100,'2',NaN,Infinity])assert.equal(calculateOrder({a:quantity},'hodan',catalog).items.length,0);
  assert.equal(calculateOrder(Object.create({a:2}),'hodan',catalog).items.length,0);
  assert.equal(calculateOrder(null,'hodan',catalog).count,0);
  assert.throws(()=>calculateOrder({a:2},'hodan',[{id:'a',name:'A',price:-100}]),RangeError);
});
test('une zone absente ou inconnue ne produit jamais une livraison gratuite',()=>{
  for(const zone of [undefined,null,'','ailleurs','__proto__']){
    const order=calculateOrder({papaye:2},zone);
    assert.equal(order.shippingFee,null);assert.equal(order.total,null);assert.equal(order.zone,null);assert.equal(order.subtotal,700);
  }
});
test('téléphones djiboutiens : formats national, international et rejet des autres pays',()=>{
  for(const phone of ['77123456','77 12 34 56','+253 77 12 34 56','00253 77 12 34 56','+253-77-12-34-56'])assert.equal(normalizeDjiboutiPhone(phone),'+25377123456');
  for(const phone of ['+221778682456','+33 6 12 34 56 78','+2537712345','+253771234567','25377123456','abc77123456','',null,77123456])assert.equal(normalizeDjiboutiPhone(phone),null);
});
test('validation obligatoire, normalisation et limites des coordonnées',()=>{
  const valid=validateCustomer(fields);assert.equal(valid.valid,true);assert.deepEqual(valid.errors,{});
  assert.equal(valid.customer.name,'Aïcha Ahmed');assert.equal(valid.customer.phone,'+25377123456');assert.equal(valid.customer.quarter,'Plateau du Serpent');
  for(const field of ['name','phone','zoneId','quarter','address','payment']){
    const result=validateCustomer({...fields,[field]:''});assert.equal(result.valid,false,field);assert.ok(result.errors[field],field);
  }
  assert.equal(validateCustomer({...fields,zoneId:'inconnue'}).valid,false);
  assert.equal(validateCustomer({...fields,payment:'card'}).valid,false);
  assert.equal(validateCustomer({...fields,notes:'x'.repeat(1001)}).valid,false);
  assert.equal(validateCustomer({...fields,notes:''}).valid,true);
  assert.equal(validateCustomer({...fields,name:'x'.repeat(121)}).valid,false);
  assert.equal(validateCustomer({...fields,quarter:'x'.repeat(121)}).valid,false);
  assert.equal(validateCustomer({...fields,address:'x'.repeat(501)}).valid,false);
  assert.equal(validateCustomer({...fields,payment:undefined,paymentMethod:'cac-bank'}).customer.payment,'cac-bank');
  assert.equal(PAYMENT_METHODS.length,3);
  for(const payment of PAYMENT_METHODS)assert.equal(validateCustomer({...fields,payment:payment.id}).valid,true);
});
test('numéros de commande générés avec l’année courante et un suffixe distinct',()=>{
  const ids=Array.from({length:100},()=>createOrderId());assert.equal(new Set(ids).size,100);
  for(const id of ids)assert.match(id,new RegExp(`^ZEM-${new Date().getUTCFullYear()}-[A-F0-9]{16}$`));
});
test('message complet, montants, modalités de paiement et notes conditionnelles',()=>{
  const order=calculateOrder({papaye:1,cafe:1},fields.zoneId);
  const customer=validateCustomer(fields).customer;
  const message=buildWhatsAppMessage(order,customer,'ZEM-2026-ABCDE');
  for(const text of ['COMMANDE ZÉMAYA — LIVRAISON','Numéro de commande : ZEM-2026-ABCDE','ARTICLES COMMANDÉS :','▪️ 1 × Gommage à la papaye et au sucre','▪️ 1 × Gommage au café et au sucre','Prix unitaire : 350 FDJ','Sous-total : 700 FDJ','Remise sur sous-total : 0 FDJ','Remise sur produit(s) : 0 FDJ','Taxes : 0 FDJ','Livraison : 500 FDJ','Nom complet : Aïcha Ahmed','Téléphone : +25377123456','Ville / Région : Djibouti-ville','Quartier : Plateau du Serpent','Adresse précise : Rue 12, maison 8','Notes : Près de l’école 🌿\nSonnez à la porte.','Mode de livraison : Livraison à domicile.','Mode de paiement choisi : D-Money','après confirmation de la commande'])assert.ok(message.includes(text),text);
  assert.match(message,/TOTAL À PAYER : 1\s200 FDJ/);
  for(const payment of ['d-money','cac-bank']){
    const result=buildWhatsAppMessage(order,{...customer,payment,notes:''},'ZEM-2026-ABCDE');
    assert.ok(result.includes('Pour D-Money et CAC Bank'));assert.ok(!result.includes('Notes :'));
  }
  const cash=buildWhatsAppMessage(order,{...customer,payment:'cash-on-delivery'},'ZEM-2026-ABCDE');
  assert.ok(cash.includes('sous réserve de confirmation par la boutique'));assert.ok(!cash.includes('Pour D-Money et CAC Bank'));
});
test('le message distingue Cité Hodan du reste de Djibouti-ville',()=>{
  for(const [zoneId,label,fee] of [['hodan','Djibouti-ville — Cité Hodan',0],['djibouti-ville','Djibouti-ville — hors Cité Hodan',500]]){
    const order=calculateOrder({papaye:1},zoneId);
    const customer=validateCustomer({...fields,zoneId}).customer;
    const message=buildWhatsAppMessage(order,customer,'ZEM-2026-ABCDE');
    assert.ok(message.includes('Ville / Région : Djibouti-ville'));
    assert.ok(message.includes(`Zone de livraison : ${label}`));
    assert.ok(message.includes(`Livraison : ${fee} FDJ`));
  }
});
test('refus des paniers vides, zones inconnues et montants altérés',()=>{
  const order=calculateOrder({papaye:2},fields.zoneId);const customer=validateCustomer(fields).customer;
  assert.throws(()=>buildWhatsAppMessage(calculateOrder({},fields.zoneId),customer,'ZEM-2026-ABCDE'));
  assert.throws(()=>buildWhatsAppMessage(calculateOrder({papaye:2},'inconnue'),customer,'ZEM-2026-ABCDE'));
  assert.throws(()=>buildWhatsAppMessage(order,{...customer,zoneId:'hodan'},'ZEM-2026-ABCDE'));
  assert.throws(()=>buildWhatsAppMessage({...order,shippingFee:0,total:700},customer,'ZEM-2026-ABCDE'));
  assert.throws(()=>buildWhatsAppMessage(order,customer,'ZEM-2026-ABCDE\nAutre texte'));
});
test('lien WhatsApp exact et encodage sans perte des accents, emoji et retours à la ligne',()=>{
  const message='ZÉMAYA 🌿\nNom : Aïcha & Élodie\nTotal : 1 200 FDJ';
  const link=buildWhatsAppUrl(message);assert.equal(WHATSAPP_NUMBER,'221778682456');
  assert.ok(link.startsWith('https://wa.me/221778682456?text='));assert.equal(link,`https://wa.me/221778682456?text=${encodeURIComponent(message)}`);
  assert.equal(new URL(link).searchParams.get('text'),message);assert.throws(()=>buildWhatsAppUrl(''));
});
