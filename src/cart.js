import {products} from './data/products.js';
export const MAX_QUANTITY=99;
export function normalizeCart(value){if(!value||typeof value!=='object'||Array.isArray(value))return {};return Object.fromEntries(products.flatMap(p=>Number.isInteger(value[p.id])&&value[p.id]>0?[[p.id,Math.min(MAX_QUANTITY,value[p.id])]]:[]));}
export function changeQuantity(cart,id,delta){if(!products.some(p=>p.id===id)||!Number.isInteger(delta))return normalizeCart(cart);const next=normalizeCart(cart);const qty=Math.max(0,Math.min(MAX_QUANTITY,(next[id]||0)+delta));if(qty)next[id]=qty;else delete next[id];return next;}
export function totals(cart){const clean=normalizeCart(cart);return products.reduce((a,p)=>({count:a.count+(clean[p.id]||0),total:a.total+(clean[p.id]||0)*p.price}),{count:0,total:0});}
export const money=value=>new Intl.NumberFormat('fr-FR').format(value)+' FDJ';
export function readCart(storage){try{return normalizeCart(JSON.parse(storage.getItem('zemaya-cart-v1')));}catch{return {};}}
