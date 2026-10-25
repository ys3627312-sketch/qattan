// =====================================================
// QATTAN — Store Script (Final Version)
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc,
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { firebaseConfig, ADMIN_EMAIL, DEFAULT_STORE_CONFIG } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// =====================================================
// الحالة العامة
// =====================================================
let storeConfig = { ...DEFAULT_STORE_CONFIG };
let products = [];
let offers = [];
let cart = [];
let favorites = [];
let orders = [];

let currentCategory = 'men';
let currentSearchQuery = '';
let currentSortValue = 'default';
let isAdminLoggedIn = false;
let currentOrdersFilter = 'all';

const STORAGE_KEYS = {
  cart: 'qattan_cart',
  favorites: 'qattan_favorites',
  darkMode: 'qattan_darkMode'
};

const MAX_QTY = 10;

// =====================================================
// أدوات مساعدة
// =====================================================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(n) {
  return Number(n || 0).toLocaleString('ar-EG');
}

function showToast(msg) {
  document.querySelectorAll('.toast-msg').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function playSound() {
  const audio = document.getElementById('successSound');
  if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
}

function buildImageUrl(url, name) {
  if (!url || !url.trim()) return `https://placehold.co/400x533/f0ebe1/1a1a1a?text=${encodeURIComponent(name || 'منتج')}`;
  return url;
}

// =====================================================
// الحفظ والتحميل
// =====================================================
function saveCart() { try { localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart)); } catch(e) {} }
function saveFavorites() { try { localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites)); } catch(e) {} }

function loadLocalState() {
  try {
    const c = localStorage.getItem(STORAGE_KEYS.cart);
    if (c) cart = JSON.parse(c) || [];
    const f = localStorage.getItem(STORAGE_KEYS.favorites);
    if (f) favorites = JSON.parse(f) || [];
  } catch(e) { console.error(e); }
}

// =====================================================
// Firebase
// =====================================================
async function loadStoreData() {
  try {
    const docRef = doc(db, 'storeData', 'main');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.storeConfig) storeConfig = { ...DEFAULT_STORE_CONFIG, ...data.storeConfig };
      if (Array.isArray(data.products)) products = data.products;
      if (Array.isArray(data.offers)) offers = data.offers;
    }
  } catch (e) { console.error(e); }
}

async function saveStoreData() {
  try {
    const docRef = doc(db, 'storeData', 'main');
    await setDoc(docRef, { storeConfig, products, offers });
  } catch (e) { console.error(e); showToast('فشل الحفظ'); }
}

async function saveOrderToFirebase(orderData) {
  try { const ref = await addDoc(collection(db, 'orders'), orderData); return ref.id; } catch (e) { return null; }
}

async function loadOrdersFromFirebase(filterType) {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    let list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
    const now = new Date();
    if (filterType === 'today') {
      const today = new Date().toDateString();
      list = list.filter(o => { const d = toDate(o.createdAt) || new Date(o.createdAtLocal || 0); return d.toDateString() === today; });
    } else if (filterType === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      list = list.filter(o => { const d = toDate(o.createdAt) || new Date(o.createdAtLocal || 0); return d >= weekAgo; });
    } else if (filterType === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 86400000);
      list = list.filter(o => { const d = toDate(o.createdAt) || new Date(o.createdAtLocal || 0); return d >= monthAgo; });
    }
    list.sort((a, b) => {
      const da = toDate(a.createdAt) || new Date(a.createdAtLocal || 0);
      const db_ = toDate(b.createdAt) || new Date(b.createdAtLocal || 0);
      return db_ - da;
    });
    return list;
  } catch (e) { return []; }
}

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === 'string') return new Date(ts);
  if (typeof ts === 'number') return new Date(ts);
  return null;
}

async function updateOrderStatusInFirebase(firestoreId, status) {
  try { await updateDoc(doc(db, 'orders', firestoreId), { status }); return true; } catch (e) { return false; }
}

// =====================================================
// إعدادات المتجر
// =====================================================
function applyStoreConfig() {
  document.title = storeConfig.name;
  const el = document.getElementById('storeName'); if (el) el.textContent = storeConfig.name;
  const addr = document.getElementById('storeAddress'); if (addr) addr.textContent = storeConfig.address;
  const hrs = document.getElementById('workingHours'); if (hrs) hrs.textContent = storeConfig.workingHours;
  const phone = document.getElementById('footerPhone'); if (phone) phone.textContent = (storeConfig.phone || '').replace(/^20/, '0');
  const waFab = document.getElementById('whatsappFab');
  if (waFab) { const num = (storeConfig.phone || '').replace(/[^0-9]/g, ''); waFab.href = `https://wa.me/${num}`; }
  const footerText = document.getElementById('footerText');
  if (footerText) footerText.textContent = `© 2025 ${storeConfig.name}`;
}

// =====================================================
// عرض المنتجات
// =====================================================
const categoryLabels = { men: 'رجالي', women: 'حريمي', kids: 'أحذية', all: 'الكل' };

function getFilteredProducts() {
  let list = [...products];
  if (currentCategory !== 'all') list = list.filter(p => p.category === currentCategory);
  if (currentSearchQuery) {
    const q = currentSearchQuery.toLowerCase().trim();
    list = list.filter(p => (p.name || '').toLowerCase().includes(q));
  }
  if (currentSortValue === 'price-low') list.sort((a, b) => (a.offerPrice || a.price) - (b.offerPrice || b.price));
  else if (currentSortValue === 'price-high') list.sort((a, b) => (b.offerPrice || b.price) - (a.offerPrice || a.price));
  else if (currentSortValue === 'rating') list.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
  return list;
}

function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) html += `<i class="fas fa-star star ${i <= Math.round(rating) ? 'active' : ''}"></i>`;
  return html;
}

function renderProductCard(p) {
  const isFav = favorites.includes(p.id);
  const hasOffer = p.offerPrice && p.offerPrice < p.price;
  const finalPrice = hasOffer ? p.offerPrice : p.price;
  const isAvail = p.isAvailable !== false;
  
  let badge = '';
  if (!isAvail) badge = '<span class="product-badge unavailable">غير متوفر</span>';
  else if (hasOffer) { const disc = Math.round((1 - p.offerPrice / p.price) * 100); badge = `<span class="product-badge sale">-${disc}%</span>`; }
  else if (p.isNew) badge = '<span class="product-badge new">جديد</span>';
  
  return `
    <div class="product-card" data-id="${p.id}">
      <div class="product-image-wrap">
        ${badge}
        <button class="fav-btn ${isFav ? 'active' : ''}" data-fav-id="${p.id}"><i class="fas fa-heart"></i></button>
        <img class="product-image" src="${escapeHtml(buildImageUrl(p.image, p.name))}" alt="${escapeHtml(p.name)}">
        <button class="quick-view-btn" data-qv-id="${p.id}">عرض سريع</button>
      </div>
      <div class="product-info">
        <p class="product-category-label">${categoryLabels[p.category] || ''}</p>
        <h3 class="product-name">${escapeHtml(p.name)}</h3>
        <div class="product-rating"><div class="stars">${renderStars(p.avgRating || 0)}</div><span class="rating-count">(${p.totalRatings || 0})</span></div>
        <div class="product-price ${hasOffer ? 'sale-price' : ''}">
          ${formatPrice(finalPrice)} ج.م ${hasOffer ? `<span class="old-price">${formatPrice(p.price)} ج.م</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderProducts() {
  const container = document.getElementById('itemsContainer');
  if (!container) return;
  const filtered = getFilteredProducts();
  const titleEl = document.getElementById('currentCategoryTitle');
  if (titleEl) titleEl.textContent = categoryLabels[currentCategory] || 'المنتجات';
  const countEl = document.getElementById('resultsCount');
  if (countEl) countEl.textContent = `${filtered.length} منتج`;
  if (filtered.length === 0) { container.innerHTML = '<div class="empty-state"><p>لا توجد منتجات</p></div>'; return; }
  container.innerHTML = filtered.map(renderProductCard).join('');
  bindProductEvents(container);
}

function renderFeatured() {
  const container = document.getElementById('newArrivalsContainer');
  if (!container) return;
  const featured = products.filter(p => p.isFeatured).slice(0, 4);
  if (featured.length === 0) { container.innerHTML = '<div class="empty-state"><p>لا توجد منتجات مميزة</p></div>'; return; }
  container.innerHTML = featured.map(renderProductCard).join('');
  bindProductEvents(container);
}

function renderNewArrivals() {
  const container = document.getElementById('newItemsContainer');
  if (!container) return;
  const newOnes = products.filter(p => p.isNew);
  if (newOnes.length === 0) { container.innerHTML = '<div class="empty-state"><p>لا توجد منتجات جديدة</p></div>'; return; }
  container.innerHTML = newOnes.map(renderProductCard).join('');
  bindProductEvents(container);
}

function renderOffers() {
  const container = document.getElementById('offersContainer');
  if (!container) return;
  if (offers.length === 0) { container.innerHTML = '<div class="empty-state"><p>لا توجد عروض</p></div>'; return; }
  container.innerHTML = offers.map(o => `
    <div class="offer-card">
      <span class="offer-tag">${escapeHtml(o.tag || 'عرض')}</span>
      <h3 class="offer-title">${escapeHtml(o.title || '')}</h3>
      <p class="offer-desc">${escapeHtml(o.desc || '')}</p>
      ${o.isAvailable !== false && o.productId ? `<button class="offer-action" data-offer-pid="${o.productId}">اكتشف العرض</button>` : ''}
    </div>
  `).join('');
  container.querySelectorAll('.offer-action').forEach(btn => btn.addEventListener('click', () => showProductDetails(parseInt(btn.dataset.offerPid))));
}

function renderFavorites() {
  const container = document.getElementById('favoritesContainer');
  if (!container) return;
  const favs = products.filter(p => favorites.includes(p.id));
  if (favs.length === 0) { container.innerHTML = '<div class="empty-state"><p>لا توجد منتجات في المفضلة</p></div>'; return; }
  container.innerHTML = favs.map(renderProductCard).join('');
  bindProductEvents(container);
}

function bindProductEvents(container) {
  container.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.fav-btn') || e.target.closest('.quick-view-btn')) return;
      showProductDetails(parseInt(card.dataset.id));
    });
  });
  container.querySelectorAll('.fav-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(parseInt(btn.dataset.favId)); }));
  container.querySelectorAll('.quick-view-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openQuickView(parseInt(btn.dataset.qvId)); }));
}

function toggleFavorite(id) {
  const idx = favorites.indexOf(id);
  if (idx === -1) { favorites.push(id); showToast('تمت الإضافة'); }
  else { favorites.splice(idx, 1); showToast('تمت الإزالة'); }
  saveFavorites();
  renderProducts(); renderFeatured(); renderNewArrivals(); renderFavorites();
}

function openQuickView(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const modal = document.getElementById('quickViewModal');
  const body = document.getElementById('quickViewBody');
  if (!modal || !body) return;
  const hasOffer = p.offerPrice && p.offerPrice < p.price;
  body.innerHTML = `
    <div class="quick-view-image"><img src="${escapeHtml(buildImageUrl(p.image, p.name))}"></div>
    <div class="quick-view-info">
      <h2>${escapeHtml(p.name)}</h2>
      <div class="product-details-price">${formatPrice(hasOffer ? p.offerPrice : p.price)} ج.م</div>
      <p>${escapeHtml((p.description || '').substring(0, 100))}...</p>
      <button class="btn-primary" style="width:100%" onclick="window.__quickViewGo(${p.id})">عرض التفاصيل</button>
    </div>
  `;
  modal.classList.add('show');
}

window.__quickViewGo = function(id) {
  document.getElementById('quickViewModal').classList.remove('show');
  showProductDetails(id);
};

function showProductDetails(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active-page'));
  const detailsPage = document.getElementById('productDetailsPage');
  if (detailsPage) { detailsPage.classList.add('active-page'); detailsPage.dataset.productId = id; }
  const bcCat = document.getElementById('breadcrumbCategory'); if (bcCat) bcCat.textContent = categoryLabels[p.category] || '';
  const bcProd = document.getElementById('breadcrumbProduct'); if (bcProd) bcProd.textContent = p.name || '';
  renderProductDetails(id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  window.history.pushState({ page: 'productDetails', id: id }, '', window.location.href);
}

function renderProductDetails(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const container = document.getElementById('productDetailsContent');
  if (!container) return;
  const isFav = favorites.includes(p.id);
  const hasOffer = p.offerPrice && p.offerPrice < p.price;
  const isAvail = p.isAvailable !== false;
  const allImgs = [p.image, ...(p.gallery || [])].filter(Boolean);
  
  let reviewsHtml = '';
  if (p.ratings && p.ratings.length > 0) {
    reviewsHtml = p.ratings.map(r => `<div class="review-item"><strong>${escapeHtml(r.userName)}</strong> <div class="stars">${renderStars(r.rating)}</div><p>${escapeHtml(r.comment || '')}</p></div>`).join('');
  } else { reviewsHtml = '<p>لا توجد تقييمات.</p>'; }
  
  container.innerHTML = `
    <div class="product-gallery"><img id="mainImage" src="${escapeHtml(buildImageUrl(allImgs[0], p.name))}"></div>
    <div class="product-info-main">
      <h1>${escapeHtml(p.name)}</h1>
      <div class="product-details-price">${formatPrice(hasOffer ? p.offerPrice : p.price)} ج.م</div>
      <p>${escapeHtml(p.description || '')}</p>
      <div class="product-actions">
        <button class="btn-add-cart" id="addToCartBtn" ${!isAvail ? 'disabled' : ''}>أضف للسلة</button>
        <button class="btn-wishlist ${isFav ? 'active' : ''}" id="wishlistBtn">❤️</button>
      </div>
      <div class="reviews-section"><h3>التقييمات</h3>${reviewsHtml}</div>
    </div>
  `;
  document.getElementById('addToCartBtn')?.addEventListener('click', () => addToCart(p));
  document.getElementById('wishlistBtn')?.addEventListener('click', () => toggleFavorite(p.id));
}

// =====================================================
// السلة
// =====================================================
function addToCart(product, qty = 1) {
  if (product.isAvailable === false) { showToast('غير متوفر'); return; }
  const existing = cart.find(c => c.id === product.id);
  const finalPrice = product.offerPrice || product.price;
  if (existing) { existing.quantity += qty; }
  else { cart.push({ id: product.id, name: product.name, image: product.image, price: finalPrice, quantity: qty }); }
  saveCart(); renderCart(); updateCartCount(); showToast('تمت الإضافة');
}

function removeFromCart(id) { cart = cart.filter(c => c.id !== id); saveCart(); renderCart(); updateCartCount(); }
function updateQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) removeFromCart(id);
  else { saveCart(); renderCart(); updateCartCount(); }
}

function updateCartCount() { const count = cart.reduce((s, c) => s + c.quantity, 0); const el = document.getElementById('cartCount'); if (el) el.textContent = count; }
function calcCartTotal() { return cart.reduce((s, c) => s + c.price * c.quantity, 0); }

function renderCart() {
  const container = document.getElementById('cartItemsList');
  const totalEl = document.getElementById('cartTotal');
  if (!container) return;
  if (cart.length === 0) { container.innerHTML = '<p>سلة فارغة</p>'; if (totalEl) totalEl.textContent = 'الإجمالي: 0'; return; }
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${escapeHtml(buildImageUrl(item.image, item.name))}" width="50">
      <div>${escapeHtml(item.name)} - ${item.price} ج.م</div>
      <div>
        <button onclick="window.__updateQty(${item.id}, -1)">-</button>
        ${item.quantity}
        <button onclick="window.__updateQty(${item.id}, 1)">+</button>
        <button onclick="window.__removeFromCart(${item.id})">حذف</button>
      </div>
    </div>
  `).join('');
  if (totalEl) totalEl.textContent = `الإجمالي: ${formatPrice(calcCartTotal())} ج.م`;
}

window.__updateQty = updateQty;
window.__removeFromCart = removeFromCart;

// =====================================================
// إرسال الطلب
// =====================================================
async function sendOrder() {
  const name = document.getElementById('customerName')?.value.trim();
  const phone = document.getElementById('customerPhone')?.value.trim();
  const city = document.getElementById('city')?.value;
  const address = document.getElementById('customerAddress')?.value.trim();
  if (!name || !phone || !city || !address) { showToast('أدخل البيانات'); return; }
  
  const total = calcCartTotal();
  const summary = cart.map(c => `${c.name} ×${c.quantity}`).join(' · ');
  const fullAddress = `${city} - ${address}`;
  
  const orderData = { customerName: name, customerPhone: phone, area: city, addressDetails: address, fullAddress, summary, total, status: 'new', createdAt: serverTimestamp() };
  const firestoreId = await saveOrderToFirebase(orderData);
  
  let msg = `طلب جديد من ${storeConfig.name}\n${summary}\nالإجمالي: ${total} ج.م\nالاسم: ${name}\nالهاتف: ${phone}\nالعنوان: ${fullAddress}`;
  
  cart = []; saveCart(); renderCart(); updateCartCount(); closeModal('orderModal'); showToast('تم الطلب'); playSound();
  window.open(`https://wa.me/${storeConfig.phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function getStatusInfo(s) { return { 'new': 'جديد', 'processing': 'قيد التنفيذ', 'completed': 'مكتمل', 'cancelled': 'ملغي' }[s] || 'جديد'; }

async function renderCustomerOrders() {
  const container = document.getElementById('completedOrdersList');
  if (!container) return;
  container.innerHTML = 'جاري التحميل...';
  const list = await loadOrdersFromFirebase('all');
  if (list.length === 0) { container.innerHTML = '<p>لا توجد طلبات</p>'; return; }
  container.innerHTML = list.map(order => `<div class="order-card"><strong>${escapeHtml(order.customerName)}</strong> - ${order.total} ج.م - ${getStatusInfo(order.status)}</div>`).join('');
}

function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }
function openCart() { document.getElementById('cartSidebar')?.classList.add('open'); document.getElementById('cartOverlay')?.classList.add('show'); }
function closeCart() { document.getElementById('cartSidebar')?.classList.remove('open'); document.getElementById('cartOverlay')?.classList.remove('show'); }

function setupDarkMode() {
  const isDark = localStorage.getItem(STORAGE_KEYS.darkMode) === 'true';
  if (isDark) document.body.classList.add('dark-mode');
  document.getElementById('darkModeToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem(STORAGE_KEYS.darkMode, document.body.classList.contains('dark-mode'));
  });
}

const areas = ["مدينة نصر", "المعادي", "الدقي", "المهندسين", "الزمالك"];
function populateAreas() {
  const select = document.getElementById('city');
  if (!select) return;
  select.innerHTML = '<option value="">اختر</option>';
  areas.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; select.appendChild(o); });
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
  document.getElementById(`${pageId}Page`)?.classList.add('active-page');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
  if (pageId === 'home') { renderFeatured(); renderProducts(); }
  if (pageId === 'new') renderNewArrivals();
  if (pageId === 'offers') renderOffers();
  if (pageId === 'favorites') renderFavorites();
  if (pageId === 'orders') renderCustomerOrders();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function init() {
  loadLocalState(); setupDarkMode(); populateAreas();
  await loadStoreData();
  applyStoreConfig(); renderFeatured(); renderProducts(); renderCart(); updateCartCount();
  
  // =====================================================
  // إعداد القائمة (الجزء الأهم)
  // =====================================================
  const navLinks = document.querySelector('.nav-links');
  const menuToggle = document.getElementById('menuToggle');
  const navOverlay = document.createElement('div');
  navOverlay.className = 'nav-overlay';
  document.body.appendChild(navOverlay);

  function closeMenu() {
    navLinks?.classList.remove('active');
    navOverlay.classList.remove('active');
  }

  menuToggle?.addEventListener('click', () => {
    navLinks?.classList.add('active');
    navOverlay.classList.add('active');
  });

  navOverlay.addEventListener('click', closeMenu);

  function navigateToPage(pageId) {
    showPage(pageId);
    closeMenu();
    window.history.pushState({ page: pageId }, '', window.location.href);
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); navigateToPage(btn.dataset.page); });
  });

  window.addEventListener('popstate', (e) => {
    if (navLinks?.classList.contains('active')) { closeMenu(); return; }
    if (e.state && e.state.page) { showPage(e.state.page); } else { showPage('home'); }
    const currentPage = (e.state && e.state.page) ? e.state.page : 'home';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === currentPage));
  });
  window.history.replaceState({ page: 'home' }, '', window.location.href);
  
  document.getElementById('heroShopBtn')?.addEventListener('click', () => document.querySelector('.section')?.scrollIntoView({ behavior: 'smooth' }));
  document.getElementById('heroNewBtn')?.addEventListener('click', () => navigateToPage('new'));
  document.querySelectorAll('.cat-pill').forEach(btn => btn.addEventListener('click', () => { currentCategory = btn.dataset.cat; document.querySelectorAll('.cat-pill').forEach(b => b.classList.toggle('active-cat', b.dataset.cat === currentCategory)); renderProducts(); }));
  document.getElementById('menuSearch')?.addEventListener('input', (e) => { currentSearchQuery = e.target.value; renderProducts(); });
  document.getElementById('cartIcon')?.addEventListener('click', openCart);
  document.getElementById('closeCartBtn')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
  document.getElementById('confirmOrderBtn')?.addEventListener('click', () => { if (cart.length === 0) { showToast('فارغة'); return; } closeCart(); setTimeout(() => document.getElementById('orderModal').classList.add('show'), 250); });
  document.getElementById('closeOrderModalBtn')?.addEventListener('click', () => closeModal('orderModal'));
  document.getElementById('sendWhatsAppBtn')?.addEventListener('click', sendOrder);
  document.getElementById('closeQuickViewBtn')?.addEventListener('click', () => closeModal('quickViewModal'));
  
  setTimeout(() => {
    const loader = document.getElementById('pageLoader');
    if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 400); }
    document.body.style.visibility = 'visible';
  }, 400);
}

init();