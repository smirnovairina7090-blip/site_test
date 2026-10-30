/* NEON DEN: frontend interacts with a real Python/Flask JSON API. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const state = { seats: [], menu: [], cart: {}, filter: 'all', slot: {}, selectedSeat: null, currentCode: '' };
  const formatMoney = amount => `${new Intl.NumberFormat('ru-RU').format(amount)} ₽`;
  const escapeHTML = str => String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const todayString = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  let toastTimeout;

  function toast(message, isError = false) {
    const node = $('#toast');
    node.textContent = message;
    node.className = `toast show${isError ? ' error' : ''}`;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => node.classList.remove('show'), 4200);
  }

  async function api(path, options = {}) {
    let response;
    try { response = await fetch(path, { headers: {'Content-Type': 'application/json'}, ...options }); }
    catch { throw new Error('Не удалось связаться с Python-сервером. Попробуй ещё раз.'); }
    let data;
    try { data = await response.json(); } catch { throw new Error('Сервер вернул неожиданный ответ.'); }
    if (!response.ok) throw new Error(data.error || `Ошибка сервера ${response.status}`);
    return data;
  }

  function getSlot() {
    return {date: $('#bookingDate').value, time: $('#bookingTime').value, hours: Number($('#bookingHours').value)};
  }

  function seatColor(type) { return ({arena:'#ac7bff',lounge:'#ff77b8',studio:'#78faff'})[type] || '#d5ff5f'; }
  function seatTag(type) { return ({arena:'⚡ HIGH PERFORMANCE',lounge:'✳ EXTRA COMFORT',studio:'◉ CREATOR MODE'})[type] || 'GAMING'; }

  async function refreshSeats() {
    state.slot = getSlot();
    const button = $('#checkSeats');
    button.disabled = true;
    $('#availabilityStatus').textContent = 'Запрашиваем данные у Python-сервера…';
    try {
      const query = new URLSearchParams(state.slot);
      const {seats} = await api(`/api/availability?${query}`);
      state.seats = seats;
      renderSeats();
      const available = seats.filter(seat => seat.available).length;
      $('#availabilityStatus').textContent = 'Актуальная доступность мест · обновлено сейчас';
      $('#availableCount').textContent = `${available} из ${seats.length} свободно`;
    } catch (error) {
      $('#availabilityStatus').textContent = 'Не удалось проверить доступность';
      $('#availableCount').textContent = 'OFFLINE';
      $('#stationGrid').innerHTML = `<div class="station-card" style="grid-column:1/-1"><h3>НЕ УДАЛОСЬ ПОЛУЧИТЬ ДАННЫЕ</h3><p>${escapeHTML(error.message)}</p></div>`;
      toast(error.message, true);
    } finally { button.disabled = false; }
  }

  function renderSeats() {
    $('#stationGrid').innerHTML = state.seats.map(seat => `
      <article class="station-card ${seat.available ? '' : 'unavailable'}" style="--seatcolor:${seatColor(seat.type)}">
        <div class="station-card-head"><span class="station-type">${seatTag(seat.type)}</span><span class="seat-availability ${seat.available ? '' : 'taken'}">● ${seat.available ? 'СВОБОДНО' : 'ЗАНЯТО'}</span></div>
        <div class="station-visual"><div class="pc-screen"></div><div class="headset"></div></div>
        <div class="station-card-foot"><div><h3>${escapeHTML(seat.name)}</h3><p>${escapeHTML(seat.label)}</p></div><div class="station-price">${formatMoney(seat.rate)}<small>за час</small></div></div>
        <button class="reserve-button" type="button" data-seat="${seat.id}" ${seat.available ? '' : 'disabled'}>${seat.available ? `ЗАБРОНИРОВАТЬ · ${formatMoney(seat.total)}` : 'МЕСТО ЗАНЯТО'} <span>↗</span></button>
      </article>`).join('');
    document.querySelectorAll('[data-seat]').forEach(button => button.addEventListener('click', () => openBooking(button.dataset.seat)));
  }

  function renderMenu() {
    const selected = state.menu.filter(item => state.filter === 'all' || state.filter === item.category);
    const tags = {coffee:'COFFEE ENERGY',cold:'ICE & VIBES',snack:'POWER SNACK'};
    const colors = {pink:'#ff62ad99',green:'#acfc7299',blue:'#69dbea99',orange:'#ffac6399'};
    $('#menuGrid').innerHTML = selected.map(item => `
      <article class="menu-card"><div class="menu-card-image" style="--foodglow:${colors[item.accent] || colors.pink}"><span class="menu-tag">${tags[item.category]}</span><span class="food-art" aria-hidden="true">${item.emoji}</span></div>
      <div class="menu-item-data"><div><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.details)}</p></div><strong class="menu-price">${formatMoney(item.price)}</strong></div>
      <button type="button" class="menu-add" data-add="${item.id}">ДОБАВИТЬ В ЗАКАЗ <span>+</span></button></article>`).join('');
    document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => addToCart(button.dataset.add)));
  }

  function addToCart(id) {
    if (!state.menu.some(item => item.id === id)) return;
    const next = (state.cart[id] || 0) + 1;
    if (next > 9) return toast('Максимум 9 штук одного товара', true);
    state.cart[id] = next;
    updateCart();
    toast('Добавлено в корзину!');
  }
  function changeQty(id, delta) {
    state.cart[id] = Math.max(0, Math.min(9, (state.cart[id] || 0) + delta));
    if (!state.cart[id]) delete state.cart[id];
    updateCart();
  }
  function updateCart() {
    const count = Object.values(state.cart).reduce((sum, n) => sum + n, 0);
    $('#cartCount').textContent = count;
    $('#floatingCartCount').textContent = count;
    const entries = state.menu.filter(item => state.cart[item.id]);
    if (!entries.length) {
      $('#cartItems').innerHTML = '<div class="cart-empty"><span>🛸</span><p>Пока пусто. Добавим немного энергии?</p></div>';
    } else {
      $('#cartItems').innerHTML = entries.map(item => `<div class="cart-row"><span class="cart-row-emoji">${item.emoji}</span><div><h3>${escapeHTML(item.name)}</h3><small>${formatMoney(item.price)} / шт.</small><div class="quantity"><button type="button" data-delta="-1" data-item="${item.id}" aria-label="Уменьшить">−</button><span>${state.cart[item.id]}</span><button type="button" data-delta="1" data-item="${item.id}" aria-label="Увеличить">+</button></div></div><strong>${formatMoney(item.price * state.cart[item.id])}</strong></div>`).join('');
      $('#cartItems').querySelectorAll('[data-delta]').forEach(button => button.addEventListener('click', () => changeQty(button.dataset.item, Number(button.dataset.delta))));
    }
    const total = entries.reduce((sum,item) => sum + item.price*state.cart[item.id],0);
    $('#cartTotal').textContent = formatMoney(total);
    $('#submitOrder').disabled = !entries.length;
  }

  function closeAll() {
    ['#bookingModal','#resultModal','#lookupModal','#cartDrawer'].forEach(sel => $(sel).hidden = true);
    $('#overlay').hidden = true;
    document.body.classList.remove('locked');
  }
  function openLayer(selector) {
    closeAll();
    $(selector).hidden = false;
    $('#overlay').hidden = false;
    document.body.classList.add('locked');
    $(selector).querySelector('input')?.focus();
  }
  function openBooking(id) {
    state.selectedSeat = state.seats.find(seat => seat.id === id);
    if (!state.selectedSeat || !state.selectedSeat.available) return toast('Место уже занято. Обновите выбор.', true);
    $('#modalDescription').textContent = `${state.selectedSeat.name} · ${state.slot.date} в ${state.slot.time} · ${state.slot.hours} ч. · ${formatMoney(state.selectedSeat.total)}. Осталось только указать имя.`;
    openLayer('#bookingModal');
  }
  function showResult(title, text, code, booking = false) {
    $('#resultTitle').textContent = title;
    $('#resultText').textContent = text;
    $('#resultCode').textContent = code;
    $('#resultModal .result-tip').textContent = booking ? 'Сохрани код, чтобы проверить бронь позднее.' : 'Это демонстрационный заказ без списания денег.';
    state.currentCode = code;
    openLayer('#resultModal');
  }

  async function submitBooking(event) {
    event.preventDefault();
    const button = $('#confirmBooking');
    button.disabled = true;
    try {
      const data = await api('/api/bookings', {method:'POST', body:JSON.stringify({...state.slot, seat_id: state.selectedSeat.id, guest: $('#guestName').value.trim()})});
      showResult('БРОНЬ ПРИНЯТА!', `${data.seat} · ${data.start.slice(0,10)} в ${data.start.slice(11,16)} · ${formatMoney(data.total)}`, data.code, true);
      $('#guestName').value = '';
      refreshSeats();
    } catch (err) {toast(err.message,true);if(err.message.includes('занято')){closeAll();refreshSeats();}}
    finally {button.disabled = false;}
  }

  async function submitOrder() {
    const button = $('#submitOrder');
    button.disabled = true;
    try {
      const items = Object.entries(state.cart).map(([id,qty]) => ({id,qty}));
      const data = await api('/api/orders',{method:'POST',body:JSON.stringify({guest: $('#orderGuest').value.trim() || 'Гость',items})});
      state.cart = {};
      updateCart();
      showResult('ЗАКАЗ ПРИНЯТ!', `${data.items.length} позиции · итого ${formatMoney(data.total)}. Пора подкрепиться!`, data.code);
    } catch(err){toast(err.message,true);}
    finally{button.disabled = false;}
  }

  async function lookupBooking(event) {
    event.preventDefault();
    const code = $('#lookupCode').value.trim().toUpperCase();
    $('#lookupResult').textContent = 'Ищем бронь…';
    try {
      const data = await api(`/api/bookings/${encodeURIComponent(code)}`);
      const seat = state.seats.find(item => item.id === data.seat_id);
      $('#lookupResult').textContent = `✓ Бронь найдена! ${seat?.name || data.seat_id} · ${data.start_at.slice(0,10)} в ${data.start_at.slice(11,16)} · ${formatMoney(data.total)} · имя: ${data.guest}`;
    } catch(err){$('#lookupResult').textContent = err.message;}
  }

  async function init() {
    const dateInput = $('#bookingDate');
    dateInput.value = todayString();
    dateInput.min = todayString();
    const max = new Date(); max.setDate(max.getDate()+60);
    dateInput.max = `${max.getFullYear()}-${String(max.getMonth()+1).padStart(2,'0')}-${String(max.getDate()).padStart(2,'0')}`;
    $('#mobileMenu').addEventListener('click', () => {const nav=$('.nav');const opened=nav.classList.toggle('is-open');$('#mobileMenu').setAttribute('aria-expanded', String(opened));});
    document.querySelectorAll('.nav a').forEach(link => link.addEventListener('click', () => {$('.nav').classList.remove('is-open');$('#mobileMenu').setAttribute('aria-expanded','false');}));
    $('#checkSeats').addEventListener('click', refreshSeats);
    ['#bookingDate','#bookingTime','#bookingHours'].forEach(selector => $(selector).addEventListener('change', refreshSeats));
    $('#bookingForm').addEventListener('submit', submitBooking);
    $('#submitOrder').addEventListener('click', submitOrder);
    $('#lookupForm').addEventListener('submit', lookupBooking);
    $('#findBooking').addEventListener('click', () => {$('#lookupResult').textContent='';openLayer('#lookupModal');});
    $('#cartOpen').addEventListener('click', () => openLayer('#cartDrawer'));
    $('#floatingCart').addEventListener('click', () => openLayer('#cartDrawer'));
    [['#closeBooking'],['#closeResult'],['#closeLookup'],['#closeCart']].forEach(([selector])=>$(selector).addEventListener('click',closeAll));
    $('#overlay').addEventListener('click',closeAll);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAll();});
    $('#copyCode').addEventListener('click', async () => {
      try {await navigator.clipboard.writeText(state.currentCode); toast('Код скопирован!');}
      catch {toast(`Твой код: ${state.currentCode}`);}
    });
    $('#menuFilters').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      $('#menuFilters').querySelectorAll('button').forEach(btn => btn.classList.toggle('active',btn===button));
      renderMenu();
    }));
    try {
      const catalog = await api('/api/catalog');
      state.menu = catalog.menu;
      renderMenu();
      updateCart();
      refreshSeats();
    } catch(error) {
      $('#menuGrid').innerHTML = `<div class="station-card" style="grid-column:1/-1"><h3>СЕРВЕР НЕДОСТУПЕН</h3><p>${escapeHTML(error.message)}</p></div>`;
      $('#stationGrid').innerHTML = '<div class="station-card" style="grid-column:1/-1">Запусти Python-сервер, чтобы проверить бронирования.</div>';
      $('#availabilityStatus').textContent = 'Сервер не отвечает';
      toast(error.message,true);
    }
  }
  document.addEventListener('DOMContentLoaded',init);
})();