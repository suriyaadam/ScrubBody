import {products} from '../src/data/products.js';
import {DELIVERY_ZONES,PAYMENT_METHODS,createOrderId} from '../src/order.js';
import {ORDER_STATUSES,PAYMENT_STATUSES,loadOrders,saveOrders,importOrders,normalizeOrder,getAnalytics,getDateRange,orderTotals} from './data.js';
import {createPreviewOrders} from './preview-data.js';
import {renderDashboardView,escapeInsights,attachChartInteractions} from './views.js';

const insightsQuery=selector=>document.querySelector(selector);
const insightState={orders:[],preview:false,view:'overview',period:'30',query:'',region:'',granularity:'day',profile:{name:'Administrateur',email:''},events:[],storageError:false};
const viewLabels={overview:"Vue d’ensemble",orders:'Commandes',sales:'Ventes',customers:'Clients',products:'Produits',geography:'Analyse géographique',trends:'Tendances',reports:'Rapports',settings:'Paramètres'};
let editingOrderId=null;
let currentAnalytics=null;
let previewRecords=null;

function insightsNotice(message,error=false){
 let node=insightsQuery('#insights-toast');
 if(!node){node=document.createElement('div');node.id='insights-toast';node.className='insights-toast';node.setAttribute('role','status');document.body.append(node);}
 node.textContent=message;node.classList.toggle('is-error',error);node.classList.add('is-visible');
 clearTimeout(insightsNotice.timer);insightsNotice.timer=setTimeout(()=>node.classList.remove('is-visible'),4500);
}
try{insightState.orders=loadOrders(localStorage);}catch(error){insightState.storageError=true;insightsNotice(error.message,true);}
try{
 const saved=JSON.parse(localStorage.getItem('zemaya-insights-profile-v1')||'null');
 if(saved&&typeof saved.name==='string')insightState.profile={name:saved.name.slice(0,100),email:typeof saved.email==='string'?saved.email.slice(0,254):''};
 if(localStorage.getItem('zemaya-insights-sidebar')==='collapsed')document.body.classList.add('sidebar-collapsed');
}catch{/* Les données restent accessibles dans cet onglet. */}

function rangeForInsights(){
 return getDateRange(insightState.period,new Date(),{start:insightsQuery('#date-start').value,end:insightsQuery('#date-end').value});
}
function insightsDate(value){return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Dakar'}).format(new Date(value));}
function insightsMoney(value){return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(value)+' FDJ';}
function activeInsightOrders(){return insightState.preview?(previewRecords||=createPreviewOrders(products,DELIVERY_ZONES)):insightState.orders;}
function renderInsights(){
 let period;try{period=rangeForInsights();}catch(error){insightsNotice(error.message,true);insightsQuery('#dashboard-view').innerHTML='<section class="chart-card chart-empty"><h2>Vérifiez votre période</h2><p>La date de fin doit suivre la date de début.</p></section>';currentAnalytics=null;return;}
 try{currentAnalytics=getAnalytics(activeInsightOrders(),{...period,query:insightState.query,region:insightState.region,granularity:insightState.granularity});}catch(error){currentAnalytics=null;insightsQuery('#dashboard-view').innerHTML='<section class="chart-card chart-empty"><h2>Vérifiez les filtres du rapport</h2><p>'+escapeInsights(error.message)+'</p></section>';insightsNotice(error.message,true);return;}
 insightsQuery('#dashboard-view').innerHTML=renderDashboardView(insightState.view,currentAnalytics,{preview:insightState.preview,catalog:products,granularity:insightState.granularity,region:insightState.region,profile:insightState.profile,periodLabel:insightsQuery('#period-filter').selectedOptions[0]?.textContent||''});
 if(insightState.storageError&&!insightState.preview)insightsQuery('#dashboard-view').innerHTML='<section class="chart-card chart-empty"><h2>Données indisponibles</h2><p>Le stockage de cet appareil ne peut pas être lu. Les données existantes ont été conservées et aucune valeur n’a été remplacée.</p></section>';
 insightsQuery('#section-title').textContent=viewLabels[insightState.view];
 document.querySelectorAll('[data-view]').forEach(button=>{const selected=button.dataset.view===insightState.view;button.classList.toggle('is-active',selected);if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
 insightsQuery('#data-mode').textContent=insightState.preview?'Prévisualisation — données fictives. Ces chiffres ne représentent pas l’activité réelle de ZÉMAYA.':'Données enregistrées sur cet appareil · Les demandes WhatsApp ne sont pas reçues automatiquement ici.';
 insightsQuery('#data-mode').classList.toggle('is-preview',insightState.preview);
 insightsQuery('#preview-toggle').textContent=insightState.preview?'Revenir aux données enregistrées':'Voir la prévisualisation';
 insightsQuery('#preview-toggle').setAttribute('aria-pressed',String(insightState.preview));
 for(const id of ['#add-order','#import-button','#export-report'])insightsQuery(id).disabled=insightState.preview||insightState.storageError;
 document.querySelectorAll('[data-profile-name]').forEach(node=>node.textContent=insightState.profile.name);
 const initials=insightState.profile.name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase();document.querySelectorAll('.sidebar .avatar,.profile-toggle .avatar,.profile-panel .avatar').forEach(node=>node.textContent=initials||'AD');
 attachChartInteractions?.(insightsQuery('#dashboard-view'));
}
function setInsightsView(view){
 insightState.view=Object.hasOwn(viewLabels,view)?view:'overview';
 document.body.classList.remove('sidebar-open');insightsQuery('#sidebar-overlay').hidden=true;
 insightsQuery('#mobile-menu-toggle').setAttribute('aria-expanded','false');
 renderInsights();
}
function routeInsights(){setInsightsView(location.hash.slice(1)||'overview');}
window.addEventListener('hashchange',routeInsights);
function changeInsightsRoute(view){if(location.hash==='#'+view)setInsightsView(view);else location.hash=view;}

insightsQuery('#today-date').textContent=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'Africa/Dakar'}).format(new Date());
insightsQuery('#period-filter').addEventListener('change',event=>{
 insightState.period=event.target.value;insightsQuery('#custom-range').hidden=insightState.period!=='custom';
 try{renderInsights();}catch(error){insightsNotice(error.message,true);}
});
for(const id of ['#date-start','#date-end'])insightsQuery(id).addEventListener('change',()=>{try{renderInsights();}catch(error){insightsNotice(error.message,true);}});
insightsQuery('#date-start').value=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
insightsQuery('#date-end').value=new Date().toISOString().slice(0,10);
let insightsSearchTimer;
insightsQuery('#global-search').addEventListener('input',event=>{clearTimeout(insightsSearchTimer);insightsSearchTimer=setTimeout(()=>{insightState.query=event.target.value.trim();renderInsights();},120);});
insightsQuery('#sidebar-toggle').addEventListener('click',()=>{const collapsed=document.body.classList.toggle('sidebar-collapsed');insightsQuery('#sidebar-toggle').setAttribute('aria-expanded',String(!collapsed));try{localStorage.setItem('zemaya-insights-sidebar',collapsed?'collapsed':'expanded');}catch{}});
insightsQuery('#mobile-menu-toggle').addEventListener('click',()=>{const open=document.body.classList.toggle('sidebar-open');insightsQuery('#sidebar-overlay').hidden=!open;insightsQuery('#mobile-menu-toggle').setAttribute('aria-expanded',String(open));if(open)insightsQuery('#sidebar [data-view]').focus();});
insightsQuery('#sidebar-toggle').setAttribute('aria-expanded',String(!document.body.classList.contains('sidebar-collapsed')));
 insightsQuery('#sidebar-overlay').addEventListener('click',()=>{document.body.classList.remove('sidebar-open');insightsQuery('#sidebar-overlay').hidden=true;insightsQuery('#mobile-menu-toggle').setAttribute('aria-expanded','false');insightsQuery('#mobile-menu-toggle').focus();});
insightsQuery('#preview-toggle').addEventListener('click',()=>{insightState.preview=!insightState.preview;renderInsights();});

function logInsightsEvent(message){insightState.events.unshift({message,date:new Date().toISOString()});insightState.events=insightState.events.slice(0,20);const count=insightsQuery('#notification-count');count.hidden=false;count.textContent=String(insightState.events.length);renderNotifications();}
function renderNotifications(){
 insightsQuery('#notifications-panel').innerHTML='<h3 id="notifications-title">Notifications</h3>'+(insightState.events.length?'<ul>'+insightState.events.map(item=>`<li><strong>${escapeInsights(item.message)}</strong><small>${escapeInsights(insightsDate(item.date))}</small></li>`).join('')+'</ul>':'<p>Aucune nouvelle activité enregistrée dans cet espace.</p>');
}
renderNotifications();
for(const [button,panel] of [['#notifications-toggle','#notifications-panel'],['#profile-toggle','#profile-panel']]){
 insightsQuery(button).addEventListener('click',()=>{const visible=insightsQuery(panel).hidden;for(const other of ['#notifications-panel','#profile-panel'])insightsQuery(other).hidden=true;insightsQuery(panel).hidden=!visible;insightsQuery(button).setAttribute('aria-expanded',String(visible));});
}

function ensureRealInsights(){if(insightState.preview){insightsNotice('Revenez aux données enregistrées pour ajouter ou modifier une commande.',true);return false;}if(insightState.storageError){insightsNotice('Le stockage des commandes est indisponible. Rétablissez l’accès aux données avant toute modification.',true);return false;}return true;}
function persistInsights(orders,message){
 try{insightState.orders=saveOrders(localStorage,orders);logInsightsEvent(message);renderInsights();insightsNotice(message);return true;}
 catch(error){insightsNotice(error.message,true);return false;}
}
function fillInsightOptions(){
 insightsQuery('#order-zone').innerHTML='<option value="">Choisir une zone</option>'+DELIVERY_ZONES.map(zone=>`<option value="${zone.id}">${escapeInsights(zone.label)}</option>`).join('');
 insightsQuery('#order-payment-method').innerHTML='<option value="">Choisir un moyen de paiement</option>'+PAYMENT_METHODS.map(item=>`<option value="${item.id}">${escapeInsights(item.label)}</option>`).join('');
 insightsQuery('#order-status').innerHTML=ORDER_STATUSES.map(item=>`<option value="${item.id}">${escapeInsights(item.label)}</option>`).join('');
 insightsQuery('#order-payment-status').innerHTML=PAYMENT_STATUSES.map(item=>`<option value="${item.id}">${escapeInsights(item.label)}</option>`).join('');
}
fillInsightOptions();
function addInsightLine(item){
 const row=document.createElement('div');row.className='order-line';
 row.innerHTML=`<label>Produit<select name="line-product" required>${products.map(p=>`<option value="${p.id}">${escapeInsights(p.name)}</option>`).join('')}</select></label><label>Quantité<input name="line-quantity" type="number" min="1" max="99" step="1" required value="1"></label><label>Prix unitaire · FDJ<input name="line-price" type="number" min="0" step="1" required value="350"></label><button type="button" class="remove-order-line" aria-label="Retirer ce produit">×</button>`;
 if(item&&!products.some(p=>p.id===item.productId)){const option=new Option(item.name+' · référence archivée',item.productId);row.querySelector('select').append(option);row.dataset.snapshotName=item.name;}
 row.querySelector('select').value=item?.productId||products[0].id;
 row.querySelector('[name=line-quantity]').value=item?.quantity||1;
 row.querySelector('[name=line-price]').value=item?.unitPrice??products[0].price;
 row.querySelector('select').addEventListener('change',event=>row.querySelector('[name=line-price]').value=products.find(p=>p.id===event.target.value)?.price??item?.unitPrice??0);
 row.querySelector('button').addEventListener('click',()=>{if(insightsQuery('#order-items').children.length>1)row.remove();else insightsNotice('Conservez au moins un produit dans la commande.',true);});
 insightsQuery('#order-items').append(row);
}
function openInsightOrder(id=null){
 if(!ensureRealInsights())return;
 const existing=id?insightState.orders.find(order=>order.id===id):null;editingOrderId=existing?.id||null;
 const form=insightsQuery('#order-form');form.reset();insightsQuery('#order-errors').hidden=true;
 insightsQuery('#order-items').replaceChildren();
 for(const item of existing?.items||[null])addInsightLine(item);
 insightsQuery('#order-reference').value=existing?.id||'';
 insightsQuery('#order-reference').readOnly=Boolean(existing);
 insightsQuery('#order-date').value=(existing?.createdAt||new Date().toISOString()).slice(0,16);
 if(existing){
  for(const field of ['name','phone','quarter','address'])insightsQuery('#order-'+field).value=existing.customer[field]||'';
  insightsQuery('#order-zone').value=existing.customer.zoneId;
  insightsQuery('#order-payment-method').value=existing.paymentMethod;
  insightsQuery('#order-status').value=existing.status;
  insightsQuery('#order-payment-status').value=existing.paymentStatus;
  insightsQuery('#order-notes').value=existing.notes||'';
 }else{insightsQuery('#order-status').value='received';insightsQuery('#order-payment-status').value='unpaid';}
 insightsQuery('#order-dialog').showModal();
}
insightsQuery('#add-order').addEventListener('click',()=>openInsightOrder());
insightsQuery('#add-order-line').addEventListener('click',()=>addInsightLine());
insightsQuery('#order-form').addEventListener('submit',event=>{
 event.preventDefault();if(!ensureRealInsights())return;
 try{
  const fields=Object.fromEntries(new FormData(event.target));
  const zone=DELIVERY_ZONES.find(zone=>zone.id===fields.zoneId);
  if(!zone)throw new Error('Choisissez la zone de livraison.');
  const items=[...document.querySelectorAll('#order-items .order-line')].map(row=>{const productId=row.querySelector('select').value;const p=products.find(p=>p.id===productId);return {productId,name:p?.name||row.dataset.snapshotName,quantity:Number(row.querySelector('[name=line-quantity]').value),unitPrice:Number(row.querySelector('[name=line-price]').value)};});
  const id=editingOrderId||fields.reference.trim()||createOrderId();
  const order=normalizeOrder({id,createdAt:new Date(fields.date+'Z').toISOString(),customer:{name:fields.name,phone:fields.phone,zoneId:fields.zoneId,quarter:fields.quarter,address:fields.address},items,paymentMethod:fields.paymentMethod,status:fields.status,paymentStatus:fields.paymentStatus,shippingFee:zone.fee,notes:fields.notes});
  if(!editingOrderId&&insightState.orders.some(item=>item.id===id))throw new Error('Cette référence existe déjà. Modifiez la commande existante.');
  const next=editingOrderId?insightState.orders.map(item=>item.id===editingOrderId?order:item):[...insightState.orders,order];
  if(persistInsights(next,editingOrderId?'Commande mise à jour.':'Commande enregistrée dans cet espace.'))insightsQuery('#order-dialog').close();
 }catch(error){insightsQuery('#order-errors').textContent=error.message;insightsQuery('#order-errors').hidden=false;}
});
function viewInsightOrder(id){
 const order=activeInsightOrders().find(item=>item.id===id);if(!order)return;
 const total=orderTotals(order);
 insightsQuery('#detail-content').innerHTML=`<p class="eyebrow">${insightState.preview?'Données fictives de prévisualisation':'Commande enregistrée'}</p><h2>${escapeInsights(order.id)}</h2><p>${escapeInsights(insightsDate(order.createdAt))}</p><dl class="detail-grid"><div><dt>Cliente / client</dt><dd>${escapeInsights(order.customer.name)}</dd></div><div><dt>Téléphone</dt><dd>${escapeInsights(order.customer.phone)}</dd></div><div><dt>Livraison</dt><dd>${escapeInsights(order.customer.quarter)}, ${escapeInsights(order.customer.address)}</dd></div><div><dt>Paiement</dt><dd>${escapeInsights(PAYMENT_METHODS.find(p=>p.id===order.paymentMethod)?.label||order.paymentMethod)} · ${escapeInsights(PAYMENT_STATUSES.find(p=>p.id===order.paymentStatus)?.label||order.paymentStatus)}</dd></div></dl><ul class="detail-items">${order.items.map(item=>`<li>${item.quantity} × ${escapeInsights(item.name)}<strong>${insightsMoney(item.quantity*item.unitPrice)}</strong></li>`).join('')}</ul><p>Livraison : ${insightsMoney(total.shippingFee)}</p><p class="detail-total">Total : <strong>${insightsMoney(total.total)}</strong></p>${order.notes?`<p>${escapeInsights(order.notes)}</p>`:''}${insightState.preview?'':'<button class="insights-button" data-action="edit-order" data-id="'+escapeInsights(order.id)+'">Modifier cette commande</button>'}`;
 insightsQuery('#detail-dialog').showModal();
}

function downloadInsights(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function exportInsightOrders(json=false){
 if(insightState.preview){insightsNotice('Revenez aux données enregistrées pour exporter un rapport.',true);return;}
 if(!currentAnalytics||insightState.storageError){insightsNotice('Les données ne sont pas disponibles pour cet export.',true);return;}
 const orders=currentAnalytics.orders||currentAnalytics.filteredOrders;
 const date=new Date().toISOString().slice(0,10);
 if(json){downloadInsights(`zemaya-${insightState.preview?'previsualisation':'commandes'}-${date}.json`,JSON.stringify({version:1,orders},null,2),'application/json');return;}
 const csvCell=value=>{let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 const rows=[['Référence','Client','Date','Articles distincts','Quantité','Région','Sous-total FDJ','Livraison FDJ','Total FDJ','Statut','Paiement','État du paiement']];
 for(const order of orders){const totals=orderTotals(order);rows.push([order.id,order.customer.name,order.createdAt,order.items.length,totals.quantity,DELIVERY_ZONES.find(z=>z.id===order.customer.zoneId)?.city,totals.subtotal,totals.shippingFee,totals.total,ORDER_STATUSES.find(s=>s.id===order.status)?.label,PAYMENT_METHODS.find(p=>p.id===order.paymentMethod)?.label,PAYMENT_STATUSES.find(p=>p.id===order.paymentStatus)?.label]);}
 downloadInsights(`zemaya-${insightState.preview?'previsualisation':'ventes'}-${date}.csv`,'\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');
}
insightsQuery('#export-report').addEventListener('click',()=>exportInsightOrders());
insightsQuery('#import-button').addEventListener('click',()=>{if(ensureRealInsights())insightsQuery('#import-data').click();});
insightsQuery('#import-data').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(!ensureRealInsights())return;if(file.size>10*1024*1024)throw new Error('Le fichier dépasse la limite de 10 Mo.');const next=importOrders(insightState.orders,await file.text());persistInsights(next,'Import terminé : '+next.length+' commande(s) enregistrée(s).');}catch(error){insightsNotice(error.message,true);}finally{event.target.value='';}});

insightsQuery('#dashboard-view').addEventListener('change',event=>{
 if(event.target.id==='chart-granularity'){insightState.granularity=event.target.value;renderInsights();}
 if(event.target.id==='chart-region'){insightState.region=event.target.value;renderInsights();}
});
insightsQuery('#dashboard-view').addEventListener('submit',event=>{
 if(event.target.id!=='profile-form')return;event.preventDefault();
 const fields=Object.fromEntries(new FormData(event.target));const name=String(fields.name||'').trim();
 if(!name)return;try{localStorage.setItem('zemaya-insights-profile-v1',JSON.stringify({name:name.slice(0,100),email:String(fields.email||'').trim().slice(0,254)}));insightState.profile={name,email:String(fields.email||'').trim()};renderInsights();insightsNotice('Profil local enregistré.');}catch{insightsNotice('Le profil n’a pas pu être enregistré sur cet appareil.',true);}
});
document.addEventListener('click',event=>{
 const view=event.target.closest('[data-view]');if(view){event.preventDefault();changeInsightsRoute(view.dataset.view);}
 const closer=event.target.closest('[data-close-dialog]');if(closer)document.getElementById(closer.dataset.closeDialog)?.close();
 const action=event.target.closest('[data-action]');if(action){const name=action.dataset.action;if(name==='new-order')openInsightOrder();if(name==='view-order')viewInsightOrder(action.dataset.id);if(name==='edit-order'){insightsQuery('#detail-dialog').close();openInsightOrder(action.dataset.id);}if(name==='export-csv')exportInsightOrders();if(name==='export-json')exportInsightOrders(true);if(name==='import-json'&&ensureRealInsights())insightsQuery('#import-data').click();if(name==='account'){insightsQuery('#profile-panel').hidden=true;changeInsightsRoute('settings');}if(name==='logout'){sessionStorage.removeItem('zemaya-insights-session');location.href='../index.html';}}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.body.classList.remove('sidebar-open');insightsQuery('#sidebar-overlay').hidden=true;insightsQuery('#mobile-menu-toggle').setAttribute('aria-expanded','false');insightsQuery('#notifications-panel').hidden=true;insightsQuery('#profile-panel').hidden=true;}});
routeInsights();
