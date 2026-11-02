import {products} from './data/products.js';

export const WHATSAPP_NUMBER='221778682456';
export const DELIVERY_ZONES=Object.freeze([
  {id:'hodan',label:'Djibouti-ville — Cité Hodan',city:'Djibouti-ville',fee:0},
  {id:'djibouti-ville',label:'Djibouti-ville — hors Cité Hodan',city:'Djibouti-ville',fee:500},
  {id:'ali-sabieh',label:'Ali-Sabieh',city:'Ali-Sabieh',fee:1000},
  {id:'tadjourah',label:'Tadjourah',city:'Tadjourah',fee:1000},
  {id:'dikhil',label:'Dikhil',city:'Dikhil',fee:1000},
  {id:'obock',label:'Obock',city:'Obock',fee:1000},
  {id:'arta',label:'Arta',city:'Arta',fee:1000}
].map(zone=>Object.freeze(zone)));
export const PAYMENT_METHODS=Object.freeze([
  {id:'d-money',label:'D-Money',note:'Les modalités de règlement seront communiquées par la boutique après réception et confirmation de votre demande WhatsApp.'},
  {id:'cac-bank',label:'CAC Bank',note:'Les modalités de règlement seront communiquées par la boutique après réception et confirmation de votre demande WhatsApp.'},
  {id:'cash-on-delivery',label:'Paiement à la livraison',note:'Le règlement sera effectué lors de la réception de la commande, sous réserve de confirmation par la boutique.'}
].map(payment=>Object.freeze(payment)));

function orderText(value){return typeof value==='string'?value.trim().replace(/\s+/g,' '):'';}
function orderNotes(value){return typeof value==='string'?value.replace(/\r\n?/g,'\n').trim():'';}
function orderAmount(value){return new Intl.NumberFormat('fr-FR').format(value)+' FDJ';}
function assertOrderAmount(value){if(!Number.isSafeInteger(value)||value<0)throw new RangeError('Le montant de la commande est invalide.');}

// Invalid/unknown cart entries are discarded; prices always come from the catalog.
// Missing delivery information remains unknown, never implicitly free.
export function calculateOrder(cart,zoneId,catalog=products){
  const quantities=cart&&typeof cart==='object'&&!Array.isArray(cart)?cart:{};
  const items=[];
  const seen=new Set();
  if(!Array.isArray(catalog))throw new TypeError('Le catalogue doit être une liste de produits.');
  for(const product of catalog){
    if(!product||typeof product.id!=='string'||!product.id||seen.has(product.id))continue;
    seen.add(product.id);
    if(!Object.hasOwn(quantities,product.id))continue;
    const quantity=quantities[product.id];
    if(!Number.isInteger(quantity)||quantity<=0||quantity>99)continue;
    assertOrderAmount(product.price);
    const lineTotal=quantity*product.price;
    assertOrderAmount(lineTotal);
    items.push({id:product.id,name:orderText(product.name),quantity,unitPrice:product.price,lineTotal});
  }
  const count=items.reduce((sum,item)=>sum+item.quantity,0);
  const subtotal=items.reduce((sum,item)=>sum+item.lineTotal,0);
  assertOrderAmount(subtotal);
  const zone=DELIVERY_ZONES.find(item=>item.id===zoneId)||null;
  const shippingFee=zone?zone.fee:null;
  const total=zone?subtotal+shippingFee:null;
  if(total!==null)assertOrderAmount(total);
  return {items,count,subtotal,discountSubtotal:0,discountProducts:0,taxes:0,shippingFee,total,zone};
}

export function normalizeDjiboutiPhone(value){
  if(typeof value!=='string')return null;
  const compact=value.trim().replace(/[\s().-]/g,'');
  const match=/^(?:\+253|00253)?(\d{8})$/.exec(compact);
  return match?'+253'+match[1]:null;
}

export function validateCustomer(fields){
  const input=fields&&typeof fields==='object'&&!Array.isArray(fields)?fields:{};
  const customer={
    name:orderText(input.name),
    phone:normalizeDjiboutiPhone(input.phone),
    zoneId:orderText(input.zoneId),
    quarter:orderText(input.quarter),
    address:orderText(input.address),
    payment:orderText(input.payment??input.paymentMethod),
    notes:orderNotes(input.notes)
  };
  const errors={};
  if(!customer.name)errors.name='Indiquez votre nom complet.';
  else if(customer.name.length>120)errors.name='Le nom ne doit pas dépasser 120 caractères.';
  if(!customer.phone)errors.phone='Indiquez un numéro djiboutien de 8 chiffres avec l’indicatif +253.';
  if(!DELIVERY_ZONES.some(zone=>zone.id===customer.zoneId))errors.zoneId='Choisissez une zone de livraison pour calculer les frais.';
  if(!customer.quarter)errors.quarter='Indiquez votre quartier.';
  else if(customer.quarter.length>120)errors.quarter='Le quartier ne doit pas dépasser 120 caractères.';
  if(!customer.address)errors.address='Indiquez votre adresse précise de livraison.';
  else if(customer.address.length>500)errors.address='L’adresse ne doit pas dépasser 500 caractères.';
  if(!PAYMENT_METHODS.some(payment=>payment.id===customer.payment))errors.payment='Choisissez un moyen de paiement.';
  if(customer.notes.length>1000)errors.notes='Les notes ne doivent pas dépasser 1 000 caractères.';
  return {valid:Object.keys(errors).length===0,errors,customer};
}

export function createOrderId(){
  const random=new Uint8Array(8);
  if(!globalThis.crypto?.getRandomValues)throw new Error('La génération sécurisée du numéro de commande est indisponible.');
  globalThis.crypto.getRandomValues(random);
  const suffix=Array.from(random,value=>value.toString(16).padStart(2,'0')).join('').toUpperCase();
  return `ZEM-${new Date().getUTCFullYear()}-${suffix}`;
}

export function buildWhatsAppMessage(order,customer,orderId){
  const validation=validateCustomer(customer);
  if(!validation.valid)throw new TypeError('Les coordonnées de livraison sont incomplètes ou invalides.');
  const normalized=validation.customer;
  const zone=DELIVERY_ZONES.find(item=>item.id===order?.zone?.id);
  if(!zone||zone.id!==normalized.zoneId||!Array.isArray(order.items)||order.items.length===0)throw new TypeError('Le panier et la zone de livraison doivent être renseignés.');
  // Check consistency before serializing, including the fixed delivery tariff.
  const ids=new Set();
  let subtotal=0,count=0;
  for(const item of order.items){
    if(!item||typeof item.id!=='string'||ids.has(item.id)||!orderText(item.name)||!Number.isInteger(item.quantity)||item.quantity<=0||item.quantity>99)throw new TypeError('Le panier contient un article invalide.');
    ids.add(item.id);
    assertOrderAmount(item.unitPrice);assertOrderAmount(item.lineTotal);
    if(item.lineTotal!==item.quantity*item.unitPrice)throw new TypeError('Le montant d’un article est incohérent.');
    subtotal+=item.lineTotal;count+=item.quantity;
  }
  assertOrderAmount(subtotal);
  if(order.count!==count||order.subtotal!==subtotal||order.shippingFee!==zone.fee||order.total!==subtotal+zone.fee||order.discountSubtotal!==0||order.discountProducts!==0||order.taxes!==0)throw new TypeError('Les montants de la commande sont incohérents.');
  if(typeof orderId!=='string'||!/^ZEM-\d{4}-[A-Z0-9]{5,64}$/.test(orderId))throw new TypeError('Le numéro de commande est invalide.');
  const payment=PAYMENT_METHODS.find(method=>method.id===normalized.payment);
  const articles=order.items.map(item=>`▪️ ${item.quantity} × ${orderText(item.name)}\nPrix unitaire : ${orderAmount(item.unitPrice)}\nTotal : ${orderAmount(item.lineTotal)}`).join('\n\n');
  const notes=normalized.notes?`\nNotes : ${normalized.notes}`:'';
  const paymentTerms=payment.id==='cash-on-delivery'
    ?'Le règlement sera effectué lors de la réception de la commande, sous réserve de confirmation par la boutique.'
    :'Pour D-Money et CAC Bank, merci de communiquer les modalités de règlement après confirmation de la commande.';
  return `COMMANDE ZÉMAYA — LIVRAISON\n\nNuméro de commande : ${orderId}\n\n━━━━━━━━━━━━━━\n\nARTICLES COMMANDÉS :\n\n${articles}\n\n━━━━━━━━━━━━━━\n\nRÉCAPITULATIF :\n\nSous-total : ${orderAmount(order.subtotal)}\nRemise sur sous-total : 0 FDJ\nRemise sur produit(s) : 0 FDJ\nTaxes : 0 FDJ\nLivraison : ${orderAmount(zone.fee)}\n\nTOTAL À PAYER : ${orderAmount(order.total)}\n\n━━━━━━━━━━━━━━\n\nINFORMATIONS DU CLIENT :\n\nNom complet : ${normalized.name}\nTéléphone : ${normalized.phone}\nVille / Région : ${zone.city}\nZone de livraison : ${zone.label}\nQuartier : ${normalized.quarter}\nAdresse précise : ${normalized.address}${notes}\n\nMode de livraison : Livraison à domicile.\nMode de paiement choisi : ${payment.label}\n\nMerci de confirmer la disponibilité des produits et les modalités de livraison de cette commande.\n\n${paymentTerms}\n\nMerci d'avoir choisi ZÉMAYA !`;
}

export function buildWhatsAppUrl(message){
  if(typeof message!=='string'||!message.trim())throw new TypeError('Le récapitulatif de commande est vide.');
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
