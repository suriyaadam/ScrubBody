import {money} from './cart.js';
import {DELIVERY_ZONES,PAYMENT_METHODS,calculateOrder,validateCustomer,createOrderId,buildWhatsAppMessage,buildWhatsAppUrl} from './order.js';

export function initCheckout({getCart,onRequestCart} = {}) {
  const cartDialog = document.querySelector('#cart-dialog');
  const checkoutDialog = document.querySelector('#checkout-dialog');
  const form = document.querySelector('#checkout-form');
  const cartZone = document.querySelector('#cart-delivery-zone');
  const checkoutZone = document.querySelector('#checkout-zone');
  const submit = document.querySelector('#checkout-submit');
  const readyPanel = document.querySelector('#checkout-ready');
  const errorPanel = document.querySelector('#checkout-errors');
  let selectedZone = '';
  let lastOrderSignature = '';
  let prepared = null;
  let submitting = false;

  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const shippingLabel = fee => fee === null ? 'À préciser' : fee === 0 ? 'Gratuit — 0 FDJ' : money(fee);
  const totalLabel = total => total === null ? 'À compléter' : money(total);
  const zoneOptions = '<option value="">Choisir une zone de livraison</option>' + DELIVERY_ZONES.map(zone => `<option value="${escapeHtml(zone.id)}">${escapeHtml(zone.label)} — ${zone.fee === 0 ? 'Gratuit' : money(zone.fee)}</option>`).join('');
  cartZone.innerHTML = zoneOptions;
  checkoutZone.innerHTML = zoneOptions;
  document.querySelector('#checkout-payment-options').innerHTML = PAYMENT_METHODS.map(method => `<label class="checkout-payment-option" for="checkout-payment-${escapeHtml(method.id)}"><input id="checkout-payment-${escapeHtml(method.id)}" type="radio" name="payment" value="${escapeHtml(method.id)}" required aria-describedby="checkout-payment-guidance"><span><strong>${escapeHtml(method.label)}</strong></span></label>`).join('');

  function clearErrors() {
    errorPanel.hidden = true;
    errorPanel.textContent = '';
    form.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute('aria-invalid'));
  }

  function invalidatePrepared() {
    prepared = null;
    readyPanel.hidden = true;
    document.querySelector('#checkout-whatsapp-link').removeAttribute('href');
    submit.disabled = false;
  }

  function orderSignature(order) {
    return JSON.stringify({zoneId:selectedZone,items:order.items.map(item => ({id:item.id,quantity:item.quantity,unitPrice:item.unitPrice})),total:order.total});
  }

  function renderSummary(order) {
    const items = order.items.length ? `<ul class="checkout-items">${order.items.map(item => `<li><div><strong>${escapeHtml(item.name)}</strong><small>${item.quantity} × ${money(item.unitPrice)}</small></div><strong>${money(item.lineTotal)}</strong></li>`).join('')}</ul>` : '<p>Votre panier est vide. Ajoutez un produit pour préparer votre commande.</p>';
    const rows = [
      ['Sous-total',money(order.subtotal)],
      ['Remise sur sous-total',money(order.discountSubtotal)],
      ['Remise sur produits',money(order.discountProducts)],
      ['Taxes',money(order.taxes)],
      ['Livraison',order.count ? shippingLabel(order.shippingFee) : '—']
    ];
    document.querySelector('#checkout-summary').innerHTML = `<p class="checkout-selected-zone">Zone de livraison : ${order.zone ? escapeHtml(order.zone.label) : 'à préciser'}.</p>${items}<dl class="checkout-costs">${rows.map(([label,value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}<div class="checkout-grand-total"><dt>Total général</dt><dd>${order.count ? totalLabel(order.total) : money(0)}</dd></div></dl>`;
  }

  function refreshPaymentGuidance() {
    const selected = form.elements.namedItem('payment')?.value;
    const note = PAYMENT_METHODS.find(method => method.id === selected)?.note || 'Choisissez un moyen de paiement pour consulter les modalités.';
    const guidance = document.querySelector('#checkout-payment-guidance');
    if (guidance.textContent !== note) guidance.textContent = note;
  }

  function refresh() {
    const order = calculateOrder(typeof getCart === 'function' ? getCart() : {},selectedZone);
    const signature = orderSignature(order);
    if (lastOrderSignature && signature !== lastOrderSignature) invalidatePrepared();
    lastOrderSignature = signature;
    cartZone.value = selectedZone;
    checkoutZone.value = selectedZone;
    document.querySelector('#cart-shipping').textContent = order.count ? shippingLabel(order.shippingFee) : '—';
    document.querySelector('#cart-shipping-hint').textContent = !order.count ? 'Ajoutez un produit pour préparer votre commande.' : order.shippingFee === null ? 'Sélectionnez votre zone pour connaître les frais de livraison et le total.' : `Livraison à domicile : ${order.zone.label}.`;
    document.querySelector('#total').textContent = order.count ? totalLabel(order.total) : money(0);
    document.querySelector('#checkout-open').disabled = order.count === 0;
    submit.disabled = order.count === 0 || Boolean(prepared);
    renderSummary(order);
    refreshPaymentGuidance();
    return order;
  }

  function changeZone(value) {
    selectedZone = DELIVERY_ZONES.some(zone => zone.id === value) ? value : '';
    clearErrors();
    invalidatePrepared();
    refresh();
    document.dispatchEvent(new CustomEvent('zemaya:delivery-change',{detail:{zoneId:selectedZone}}));
  }

  cartZone.addEventListener('change',() => changeZone(cartZone.value));
  checkoutZone.addEventListener('change',() => changeZone(checkoutZone.value));
  document.querySelector('#checkout-open').addEventListener('click',() => {
    const order = refresh();
    if (!order.count) return;
    cartDialog.close();
    if (!checkoutDialog.open) checkoutDialog.showModal();
  });
  document.querySelector('#checkout-back').addEventListener('click',() => {
    checkoutDialog.close();
    if (typeof onRequestCart === 'function') onRequestCart();
  });
  form.addEventListener('input',event => { if (event.target === checkoutZone) return; invalidatePrepared(); clearErrors(); refresh(); });
  form.addEventListener('change',event => {
    if (event.target !== checkoutZone) {
      invalidatePrepared();
      clearErrors();
      refresh();
    }
  });

  function showErrors(errors) {
    errorPanel.textContent = Object.values(errors).join(' ');
    errorPanel.hidden = false;
    const ids = {name:'checkout-name',phone:'checkout-phone',zoneId:'checkout-zone',quarter:'checkout-quarter',address:'checkout-address',payment:'checkout-payment-options',notes:'checkout-notes'};
    let firstField;
    for (const key of Object.keys(errors)) {
      const field = document.getElementById(ids[key]);
      if (!field) continue;
      const control = field.matches('input,select,textarea') ? field : field.querySelector('input');
      if (control) {
        control.setAttribute('aria-invalid','true');
        firstField ||= control;
      }
    }
    firstField?.focus();
  }

  form.addEventListener('submit',event => {
    event.preventDefault();
    if (submitting) return;
    clearErrors();
    if (!form.reportValidity()) return;
    const fields = Object.fromEntries(new FormData(form));
    const result = validateCustomer(fields);
    if (!result.valid) {
      showErrors(result.errors);
      return;
    }
    const order = refresh();
    if (!order.count || order.shippingFee === null || order.total === null) {
      showErrors({zoneId:'Vérifiez votre panier et sélectionnez une zone de livraison.'});
      return;
    }
    submitting = true;
    try {
      const customer = result.customer;
      const fingerprint = JSON.stringify({order:orderSignature(order),customer});
      if (prepared?.fingerprint === fingerprint) return;
      const id = createOrderId();
      const message = buildWhatsAppMessage(order,customer,id);
      const url = buildWhatsAppUrl(message);
      prepared = {fingerprint,id,url};
      submit.disabled = true;
      document.querySelector('#checkout-order-id').textContent = id;
      document.querySelector('#checkout-whatsapp-link').href = url;
      readyPanel.hidden = false;
      try { window.open(url,'_blank','noopener,noreferrer'); } catch { /* Le lien direct reste disponible si l’ouverture est bloquée. */ }
      readyPanel.scrollIntoView({block:'nearest'});
    } catch {
      invalidatePrepared();
      errorPanel.textContent = 'Le récapitulatif n’a pas pu être préparé. Vérifiez vos informations et réessayez.';
      errorPanel.hidden = false;
    } finally {
      submitting = false;
    }
  });

  refresh();
  return {refresh,getZoneId:() => selectedZone};
}
