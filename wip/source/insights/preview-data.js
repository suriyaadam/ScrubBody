// Données fictives, exclusivement pour le mode de prévisualisation explicite.
// Cette liste n’est jamais enregistrée dans le stockage des commandes réelles.
export function createPreviewOrders(catalog,zones,now=new Date()){
 const statuses=['delivered','confirmed','delivered','preparing','received','delivered','cancelled','delivering'];
 const methods=['d-money','d-money','cac-bank','cash-on-delivery','d-money','cash-on-delivery'];
 return Array.from({length:112},(_,index)=>{
  const age=1+Math.floor(index*.8);
  const createdAt=new Date(now.getTime()-age*86400000-(index%8)*3600000).toISOString();
  const zone=zones[[0,1,1,1,2,6,3,4,5][index%9]];
  const status=statuses[index%statuses.length];
  const items=Array.from({length:1+index%3},(_,line)=>{
   const product=catalog[(index+line)%catalog.length];
   return {productId:product.id,name:product.name,quantity:1+(index+line)%4,unitPrice:product.price};
  });
  return {id:`ZEM-${new Date(createdAt).getUTCFullYear()}-PREV${String(index+1).padStart(5,'0')}`,createdAt,customer:{name:`Cliente de prévisualisation ${String(index%34+1).padStart(2,'0')}`,phone:`+25377${String(100000+index%34).padStart(6,'0')}`,zoneId:zone.id,quarter:'Quartier de prévisualisation',address:'Adresse fictive réservée à la prévisualisation'},items,paymentMethod:methods[index%methods.length],status,paymentStatus:status==='received'||status==='cancelled'||index%5===0?'unpaid':'paid',shippingFee:zone.fee,notes:'Donnée fictive de prévisualisation.'};
 });
}
