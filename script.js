// =====================================================
// QATTAN — Store Script (Firebase Edition)
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc,
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { firebaseConfig, ADMIN_EMAIL, DEFAULT_STORE_CONFIG } from "./firebase-config.js";

// =====================================================
// Firebase Init
// =====================================================
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
let reportedReviews = [];

let currentCategory = 'men';
let currentSearchQuery = '';
let currentSortValue = 'default';
let lastProductId = null;

let isAdminLoggedIn = false;
let currentOrdersFilter = 'all';

const STORAGE_KEYS = {
  cart: 'qattan_cart',
  favorites: 'qattan_favorites',
  darkMode: 'qattan_darkMode',
  lastProduct: 'qattan_lastProduct'
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
  if (!url || !url.trim()) {
    return `https://placehold.co/400x533/f0ebe1/1a1a1a?text=${encodeURIComponent(name || 'منتج')}`;
  }
  return url;
}

// =====================================================
// الحفظ والتحميل من localStorage
// =====================================================
function saveCart() {
  try { localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart)); } catch(e) {}
}
function saveFavorites() {
  try { localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites)); } catch(e) {}
}
function loadLocalState() {
  try {
    const c = localStorage.getItem(STORAGE_KEYS.cart);
    if (c) cart = JSON.parse(c) || [];
    const f = localStorage.getItem(STORAGE_KEYS.favorites);
    if (f) favorites = JSON.parse(f) || [];
    const lp = localStorage.getItem(STORAGE_KEYS.lastProduct);
    if (lp) lastProductId = parseInt(lp);
  } catch(e) { console.error('loadLocalState error:', e); }
}

// =====================================================
// Firebase — تحميل بيانات المتجر
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
  } catch (e) {
    console.error('loadStoreData error:', e);
  }
}

async function saveStoreData() {
  try {
    const docRef = doc(db, 'storeData', 'main');
    await setDoc(docRef, { storeConfig, products, offers });
  } catch (e) {
    console.error('saveStoreData error:', e);
    showToast('فشل الحفظ في Firebase');
  }
}

// =====================================================
// Firebase — الطلبات
// =====================================================
async function saveOrderToFirebase(orderData) {
  try {
    const ref = await addDoc(collection(db, 'orders'), orderData);
    return ref.id;
  } catch (e) {
    console.error('saveOrder error:', e);
    return null;
  }
}

async function loadOrdersFromFirebase(filterType) {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    let list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));

    const now = new Date();
    if (filterType === 'today') {
      const today = new Date().toDateString();
      list = list.filter(o => {
        const d = toDate(o.createdAt) || new Date(o.createdAtLocal || 0);
        return d.toDateString() === today;
      });
    } else if (filterType === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      list = list.filter(o => {
        const d = toDate(o.createdAt) || new Date(o.createdAtLocal || 0);
        return d >= weekAgo;
      });
    } else if (filterType === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 86400000);
      list = list.filter(o => {
        const d = toDate(o.createdAt) || new Date(o.createdAtLocal || 0);
        return d >= monthAgo;
      });
    }

    list.sort((a, b) => {
      const da = toDate(a.createdAt) || new Date(a.createdAtLocal || 0);
      const db_ = toDate(b.createdAt) || new Date(b.createdAtLocal || 0);
      return db_ - da;
    });

    return list;
  } catch (e) {
    console.error('loadOrders error:', e);
    return [];
  }
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
  try {
    await updateDoc(doc(db, 'orders', firestoreId), { status });
    return true;
  } catch (e) {
    console.error('updateOrderStatus error:', e);
    return false;
  }
}

async function deleteOrderFromFirebase(firestoreId) {
  try {
    await deleteDoc(doc(db, 'orders', firestoreId));
    return true;
  } catch (e) {
    console.error('deleteOrder error:', e);
    return false;
  }
}

// =====================================================
// إعدادات المتجر على الصفحة
// =====================================================
function applyStoreConfig() {
  document.title = storeConfig.name + ' | ملابس بجودة عالية';
  
  const el = document.getElementById('storeName');
  if (el) el.textContent = storeConfig.name;
  
  const addr = document.getElementById('storeAddress');
  if (addr) addr.textContent = storeConfig.address;
  
  const hrs = document.getElementById('workingHours');
  if (hrs) hrs.textContent = storeConfig.workingHours;
  
  const phone = document.getElementById('footerPhone');
  if (phone) phone.textContent = (storeConfig.phone || '').replace(/^20/, '0');
  
  const waFab = document.getElementById('whatsappFab');
  if (waFab) {
    const num = (storeConfig.phone || '').replace(/[^0-9]/g, '');
    waFab.href = `https://wa.me/${num}`;
  }
  
  const footerText = document.getElementById('footerText');
  if (footerText) {
    footerText.textContent = `© 2025 ${storeConfig.name} | ${(storeConfig.phone || '').replace(/^20/, '0')}`;
  }
}

// =====================================================
// عرض المنتجات
// =====================================================
const categoryLabels = { men: 'رجالي', women: 'حريمي', kids: 'ولادي', all: 'الكل' };

function getFilteredProducts() {
  let list = [...products];
  if (currentCategory !== 'all') list = list.filter(p => p.category === currentCategory);
  
  if (currentSearchQuery) {
    const q = currentSearchQuery.toLowerCase().trim();
    list = list.filter(p => (p.name || '').toLowerCase().includes(q));
  }
  
  if (currentSortValue === 'price-low') {
    list.sort((a, b) => (a.offerPrice || a.price) - (b.offerPrice || b.price));
  } else if (currentSortValue === 'price-high') {
    list.sort((a, b) => (b.offerPrice || b.price) - (a.offerPrice || a.price));
  } else if (currentSortValue === 'rating') {
    list.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
  }
  
  return list;
}

function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<i class="fas fa-star star ${i <= Math.round(rating) ? 'active' : ''}"></i>`;
  }
  return html;
}

function renderProductCard(p) {
  const isFav = favorites.includes(p.id);
  const hasOffer = p.offerPrice && p.offerPrice < p.price;
  const finalPrice = hasOffer ? p.offerPrice : p.price;
  const isAvail = p.isAvailable !== false;
  
  let badge = '';
  if (!isAvail) badge = '<span class="product-badge unavailable">غير متوفر</span>';
  else if (hasOffer) {
    const disc = Math.round((1 - p.offerPrice / p.price) * 100);
    badge = `<span class="product-badge sale">-${disc}%</span>`;
  } else if (p.isNew) {
    badge = '<span class="product-badge new">جديد</span>';
  }
  
  return `
    <div class="product-card" data-id="${p.id}">
      <div class="product-image-wrap">
        ${badge}
        <button class="fav-btn ${isFav ? 'active' : ''}" data-fav-id="${p.id}" aria-label="مفضلة">
          <i class="fas fa-heart"></i>
        </button>
        <img class="product-image" src="${escapeHtml(buildImageUrl(p.image, p.name))}" alt="${escapeHtml(p.name)}" loading="lazy">
        <button class="quick-view-btn" data-qv-id="${p.id}">عرض سريع</button>
      </div>
      <div class="product-info">
        <p class="product-category-label">${categoryLabels[p.category] || ''}</p>
        <h3 class="product-name">${escapeHtml(p.name)}</h3>
        <div class="product-rating">
          <div class="stars">${renderStars(p.avgRating || 0)}</div>
          <span class="rating-count">(${p.totalRatings || 0})</span>
        </div>
        <div class="product-price ${hasOffer ? 'sale-price' : ''}">
          ${formatPrice(finalPrice)} ج.م
          ${hasOffer ? `<span class="old-price">${formatPrice(p.price)} ج.م</span>` : ''}
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
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <p>لا توجد منتجات في هذا القسم</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filtered.map(renderProductCard).join('');
  bindProductEvents(container);
}

function renderFeatured() {
  const container = document.getElementById('newArrivalsContainer');
  if (!container) return;
  
  const featured = products.filter(p => p.isFeatured).slice(0, 4);
  
  if (featured.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>لا توجد منتجات مميزة</p></div>';
    return;
  }
  
  container.innerHTML = featured.map(renderProductCard).join('');
  bindProductEvents(container);
}

function renderNewArrivals() {
  const container = document.getElementById('newItemsContainer');
  if (!container) return;
  
  const newOnes = products.filter(p => p.isNew);
  
  if (newOnes.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>لا توجد منتجات جديدة</p></div>';
    return;
  }
  
  container.innerHTML = newOnes.map(renderProductCard).join('');
  bindProductEvents(container);
}

function renderOffers() {
  const container = document.getElementById('offersContainer');
  if (!container) return;
  
  if (offers.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-tags"></i><p>لا توجد عروض حالياً</p></div>';
    return;
  }
  
  container.innerHTML = offers.map(o => `
    <div class="offer-card">
      <span class="offer-tag">${escapeHtml(o.tag || 'عرض')}</span>
      <h3 class="offer-title">${escapeHtml(o.title || '')}</h3>
      <p class="offer-desc">${escapeHtml(o.desc || '')}</p>
      ${o.isAvailable !== false && o.productId ? `
        <button class="offer-action" data-offer-pid="${o.productId}">اكتشف العرض</button>
      ` : '<span style="opacity:0.5;">غير متوفر</span>'}
    </div>
  `).join('');
  
  container.querySelectorAll('.offer-action').forEach(btn => {
    btn.addEventListener('click', () => showProductDetails(parseInt(btn.dataset.offerPid)));
  });
}

function renderFavorites() {
  const container = document.getElementById('favoritesContainer');
  if (!container) return;
  
  const favs = products.filter(p => favorites.includes(p.id));
  
  if (favs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="far fa-heart"></i>
        <p>لا توجد منتجات في المفضلة</p>
      </div>
    `;
    return;
  }
  
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
  
  container.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(parseInt(btn.dataset.favId));
    });
  });
  
  container.querySelectorAll('.quick-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openQuickView(parseInt(btn.dataset.qvId));
    });
  });
}

// =====================================================
// المفضلة
// =====================================================
function toggleFavorite(id) {
  const idx = favorites.indexOf(id);
  if (idx === -1) { favorites.push(id); showToast('تمت الإضافة للمفضلة'); }
  else { favorites.splice(idx, 1); showToast('تمت الإزالة من المفضلة'); }
  saveFavorites();
  renderProducts();
  renderFeatured();
  renderNewArrivals();
  renderFavorites();
}

// =====================================================
// Quick View
// =====================================================
function openQuickView(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  
  const modal = document.getElementById('quickViewModal');
  const body = document.getElementById('quickViewBody');
  if (!modal || !body) return;
  
  const hasOffer = p.offerPrice && p.offerPrice < p.price;
  const finalPrice = hasOffer ? p.offerPrice : p.price;
  
  body.innerHTML = `
    <div class="quick-view-image">
      <img src="${escapeHtml(buildImageUrl(p.image, p.name))}" alt="${escapeHtml(p.name)}">
    </div>
    <div class="quick-view-info">
      <p style="font-size:0.72rem;letter-spacing:1.5px;color:var(--text-soft);font-weight:600;">
        ${categoryLabels[p.category] || ''}
      </p>
      <h2>${escapeHtml(p.name)}</h2>
      <div class="product-details-rating">
        <div class="stars">${renderStars(p.avgRating || 0)}</div>
        <span class="count">(${p.totalRatings || 0} تقييم)</span>
      </div>
      <div class="product-details-price ${hasOffer ? 'sale-price' : ''}">
        ${formatPrice(finalPrice)} ج.م
        ${hasOffer ? `<span class="old">${formatPrice(p.price)} ج.م</span>` : ''}
      </div>
      <p style="font-size:0.88rem;color:var(--text-soft);line-height:1.7;">
        ${escapeHtml((p.description || '').substring(0, 100))}...
      </p>
      <button class="btn-primary" style="width:100%;margin-top:auto;" onclick="window.__quickViewGo(${p.id})">
        عرض التفاصيل الكاملة
      </button>
    </div>
  `;
  
  modal.classList.add('show');
}

window.__quickViewGo = function(id) {
  document.getElementById('quickViewModal').classList.remove('show');
  showProductDetails(id);
};

// =====================================================
// صفحة تفاصيل المنتج
// =====================================================
function showProductDetails(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  
  lastProductId = id;
  localStorage.setItem(STORAGE_KEYS.lastProduct, id);
  
  document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active-page'));
  const detailsPage = document.getElementById('productDetailsPage');
  if (detailsPage) {
    detailsPage.classList.add('active-page');
    detailsPage.dataset.productId = id;
  }
  
  const bcCat = document.getElementById('breadcrumbCategory');
  if (bcCat) bcCat.textContent = categoryLabels[p.category] || '';
  const bcProd = document.getElementById('breadcrumbProduct');
  if (bcProd) bcProd.textContent = p.name || '';
  
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
  const finalPrice = hasOffer ? p.offerPrice : p.price;
  const isAvail = p.isAvailable !== false;
  
  const allImgs = [p.image, ...(p.gallery || [])].filter(Boolean);
  
  let reviewsHtml = '';
  if (p.ratings && p.ratings.length > 0) {
    reviewsHtml = p.ratings.map(r => {
      let repliesHtml = '';
      if (r.replies && r.replies.length > 0) {
        repliesHtml = r.replies.map(reply => `
          <div class="reply-item store-reply">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
              <strong><span class="store-badge">إدارة المتجر</span> ${escapeHtml(reply.userName || 'المتجر')}</strong>
            </div>
            <p style="font-size:0.9rem; margin:0;">${escapeHtml(reply.text)}</p>
          </div>
        `).join('');
      }
      
      return `
        <div class="review-item">
          <div class="review-header">
            <div class="review-user">
              <i class="fas fa-user-circle"></i>
              <span>${escapeHtml(r.userName)}</span>
            </div>
            <div class="review-stars">${renderStars(r.rating)}</div>
            <div class="review-date">${new Date(r.date).toLocaleDateString('ar-EG')}</div>
          </div>
          ${r.comment ? `<p class="review-comment">${escapeHtml(r.comment)}</p>` : ''}
          ${repliesHtml}
        </div>
      `;
    }).join('');
  } else {
    reviewsHtml = '<div class="no-reviews">لا توجد تقييمات بعد، كن أول من يقيم!</div>';
  }
  
  container.innerHTML = `
    <div class="product-gallery">
      <div class="product-gallery-main">
        <img id="mainImage" src="${escapeHtml(buildImageUrl(allImgs[0], p.name))}" alt="${escapeHtml(p.name)}">
      </div>
      ${allImgs.length > 1 ? `
        <div class="product-gallery-thumbs">
          ${allImgs.map((img, i) => `
            <div class="gallery-thumb ${i === 0 ? 'active' : ''}" data-img-idx="${i}">
              <img src="${escapeHtml(buildImageUrl(img, p.name))}" alt="">
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
    
    <div class="product-info-main">
      <p style="font-size:0.72rem;letter-spacing:2px;color:var(--accent);font-weight:700;">
        ${categoryLabels[p.category] || ''}
      </p>
      <h1 class="product-details-title">${escapeHtml(p.name)}</h1>
      
      <div class="product-details-rating">
        <div class="stars">${renderStars(p.avgRating || 0)}</div>
        <span class="count">(${p.totalRatings || 0} تقييم)</span>
      </div>
      
      <div class="product-details-price ${hasOffer ? 'sale-price' : ''}">
        ${formatPrice(finalPrice)} ج.م
        ${hasOffer ? `<span class="old">${formatPrice(p.price)} ج.م</span>` : ''}
      </div>
      
      <p class="product-description">${escapeHtml(p.description || '')}</p>
      
      ${p.sizes && p.sizes.length ? `
        <div class="option-section">
          <div class="option-header">
            <span class="option-label">المقاس</span>
            <button class="size-guide-link" onclick="document.getElementById('sizeGuideModal').classList.add('show')">
              <i class="fas fa-ruler"></i> دليل المقاسات
            </button>
          </div>
          <div class="size-selector">
            ${p.sizes.map((s, i) => `
              <button class="size-pill ${i === 0 ? 'selected' : ''}" data-size="${escapeHtml(s)}">${escapeHtml(s)}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${p.colors && p.colors.length ? `
        <div class="option-section">
          <div class="option-header"><span class="option-label">اللون</span></div>
          <div class="color-selector">
            ${p.colors.map((c, i) => `
              <button class="color-swatch ${i === 0 ? 'selected' : ''}" 
                data-color='${escapeHtml(JSON.stringify(c))}' 
                style="background:${c.hex};" title="${escapeHtml(c.name)}"></button>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="product-actions">
        <button class="btn-add-cart" id="addToCartBtn" ${!isAvail ? 'disabled' : ''}>
          <i class="fas fa-shopping-bag"></i>
          ${isAvail ? 'أضف إلى السلة' : 'غير متوفر'}
        </button>
        <button class="btn-wishlist ${isFav ? 'active' : ''}" id="wishlistBtn" aria-label="مفضلة">
          <i class="fas fa-heart"></i>
        </button>
      </div>
      
      <div class="reviews-section">
        <h3>التقييمات</h3>
        <div class="reviews-list">${reviewsHtml}</div>
        <div class="add-review-form">
          <h4>أضف تقييمك</h4>
          <div class="rating-input" id="ratingInput">
            ${[1,2,3,4,5].map(s => `<i class="fas fa-star star" data-rating="${s}"></i>`).join('')}
          </div>
          <input type="text" id="reviewName" class="review-name-input" placeholder="اسمك">
          <textarea id="reviewComment" class="review-comment-input" placeholder="رأيك (اختياري)"></textarea>
          <button class="btn-submit-review" id="submitReviewBtn">إرسال التقييم</button>
        </div>
      </div>
    </div>
  `;
  
  let selSize = p.sizes?.[0] || null;
  let selColor = p.colors?.[0] || null;
  
  container.querySelectorAll('.size-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.size-pill').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selSize = btn.dataset.size;
    });
  });
  
  container.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      try { selColor = JSON.parse(btn.dataset.color); } catch(e) { selColor = null; }
    });
  });
  
  container.querySelectorAll('.gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const idx = parseInt(thumb.dataset.imgIdx);
      const mainImg = document.getElementById('mainImage');
      if (mainImg) mainImg.src = buildImageUrl(allImgs[idx], p.name);
      container.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });
  
  document.getElementById('addToCartBtn')?.addEventListener('click', () => {
    addToCart(p, 1, selSize, selColor);
  });
  
  document.getElementById('wishlistBtn')?.addEventListener('click', () => toggleFavorite(p.id));
  
  let selectedRating = 0;
  container.querySelectorAll('#ratingInput .star').forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.rating);
      container.querySelectorAll('#ratingInput .star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.rating) <= selectedRating);
      });
    });
  });
  
  document.getElementById('submitReviewBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('reviewName')?.value.trim();
    const comment = document.getElementById('reviewComment')?.value.trim() || '';
    if (!name) { showToast('الرجاء إدخال اسمك'); return; }
    if (selectedRating === 0) { showToast('الرجاء اختيار تقييم'); return; }
    
    if (!p.ratings) p.ratings = [];
    p.ratings.push({ userName: name, rating: selectedRating, comment, date: new Date().toISOString() });
    p.avgRating = p.ratings.reduce((s, r) => s + r.rating, 0) / p.ratings.length;
    p.totalRatings = p.ratings.length;
    
    await saveStoreData();
    showToast('شكراً لتقييمك!');
    playSound();
    renderProductDetails(p.id);
  });
}

// =====================================================
// السلة
// =====================================================
function addToCart(product, qty = 1, size = null, color = null) {
  if (product.isAvailable === false) {
    showToast('هذا المنتج غير متوفر');
    return;
  }
  
  const variantKey = `${product.id}_${size || ''}_${color?.name || ''}`;
  const existing = cart.find(c => c.variantKey === variantKey);
  const finalPrice = product.offerPrice || product.price;
  
  if (existing) {
    if (existing.quantity + qty > MAX_QTY) {
      showToast(`لا يمكنك طلب أكثر من ${MAX_QTY} قطع`);
      return;
    }
    existing.quantity += qty;
  } else {
    cart.push({
      variantKey,
      id: product.id,
      name: product.name,
      image: product.image,
      price: finalPrice,
      size,
      color: color?.name || null,
      colorHex: color?.hex || null,
      quantity: qty
    });
  }
  
  saveCart();
  renderCart();
  updateCartCount();
  showToast('تمت الإضافة إلى السلة');
  playSound();
}

function removeFromCart(key) {
  cart = cart.filter(c => c.variantKey !== key);
  saveCart();
  renderCart();
  updateCartCount();
}

function updateQty(key, delta) {
  const item = cart.find(c => c.variantKey === key);
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty <= 0) { removeFromCart(key); return; }
  if (newQty > MAX_QTY) { showToast(`الحد الأقصى ${MAX_QTY}`); return; }
  item.quantity = newQty;
  saveCart();
  renderCart();
  updateCartCount();
}

function updateCartCount() {
  const count = cart.reduce((s, c) => s + c.quantity, 0);
  const el = document.getElementById('cartCount');
  if (el) el.textContent = count;
}

function calcCartTotal() {
  return cart.reduce((s, c) => s + c.price * c.quantity, 0);
}

function renderCart() {
  const container = document.getElementById('cartItemsList');
  const totalEl = document.getElementById('cartTotal');
  if (!container) return;
  
  if (cart.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-basket"></i><p>سلة فارغة</p></div>';
    if (totalEl) totalEl.textContent = 'الإجمالي: 0 ج.م';
    return;
  }
  
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-image" src="${escapeHtml(buildImageUrl(item.image, item.name))}" alt="${escapeHtml(item.name)}">
      <div class="cart-item-content">
        <div class="cart-item-title">${escapeHtml(item.name)}</div>
        ${item.size || item.color ? `
          <div class="cart-item-variant">
            ${item.size ? `مقاس: ${escapeHtml(item.size)}` : ''}
            ${item.size && item.color ? ' • ' : ''}
            ${item.color ? `لون: ${escapeHtml(item.color)}` : ''}
          </div>
        ` : ''}
        <div class="cart-item-bottom">
          <div class="cart-qty-controls">
            <button class="cart-qty-btn" data-minus="${escapeHtml(item.variantKey)}"><i class="fas fa-minus"></i></button>
            <span class="cart-qty-value">${item.quantity}</span>
            <button class="cart-qty-btn" data-plus="${escapeHtml(item.variantKey)}"><i class="fas fa-plus"></i></button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="cart-item-price">${formatPrice(item.price * item.quantity)} ج.م</span>
            <button class="cart-remove" data-remove="${escapeHtml(item.variantKey)}"><i class="fas fa-times"></i></button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  
  const total = calcCartTotal();
  if (totalEl) totalEl.textContent = `الإجمالي: ${formatPrice(total)} ج.م`;
  
  container.querySelectorAll('[data-plus]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.plus, 1)));
  container.querySelectorAll('[data-minus]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.minus, -1)));
  container.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.remove)));
}

// =====================================================
// إرسال الطلب
// =====================================================
function validatePhone(phone) {
  if (!phone) return { valid: false };
  if (phone.length !== 10) return { valid: false, reason: 'الرقم لازم 10 أرقام' };
  const networks = { '010': 'فودافون', '011': 'اتصالات', '012': 'أورنج', '015': 'وي' };
  if (!networks[phone.substring(0, 3)]) return { valid: false, reason: 'كود الشبكة غير صحيح' };
  return { valid: true, network: networks[phone.substring(0, 3)], full: '+20' + phone.substring(1) };
}

async function sendOrder() {
  const name = document.getElementById('customerName')?.value.trim();
  const phone = document.getElementById('customerPhone')?.value.trim();
  const city = document.getElementById('city')?.value;
  const address = document.getElementById('customerAddress')?.value.trim();
  const payment = document.getElementById('paymentMethod')?.value;
  const notes = document.getElementById('customerNotes')?.value.trim() || '';
  
  if (!name || !phone || !city || !address) {
    showToast('الرجاء ملء جميع البيانات');
    return;
  }
  
  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.valid) {
    showToast(phoneCheck.reason || 'رقم غير صحيح');
    return;
  }
  
  const total = calcCartTotal();
  const summary = cart.map(c => `${c.name} ×${c.quantity}`).join(' · ');
  const fullAddress = `${city} - ${address}`;
  
  const orderData = {
    customerName: name,
    customerPhone: phoneCheck.full,
    customerPhoneLocal: phone,
    customerNetwork: phoneCheck.network,
    area: city,
    addressDetails: address,
    fullAddress,
    paymentMethod: payment,
    notes,
    items: cart.map(c => ({
      id: c.id, name: c.name, price: c.price, quantity: c.quantity,
      size: c.size, color: c.color
    })),
    summary,
    total,
    status: 'new',
    createdAt: serverTimestamp(),
    createdAtLocal: new Date().toISOString()
  };
  
  const firestoreId = await saveOrderToFirebase(orderData);
  
  if (!firestoreId) {
    showToast('فشل إرسال الطلب — حاول مرة تانية');
    return;
  }
  
  // رسالة واتساب
  let msg = `طلب جديد من ${storeConfig.name}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n`;
  cart.forEach(c => {
    msg += `• ${c.name}`;
    if (c.size) msg += ` (${c.size})`;
    if (c.color) msg += ` - ${c.color}`;
    msg += ` ×${c.quantity} = ${c.price * c.quantity} ج.م\n`;
  });
  msg += `━━━━━━━━━━━━━━━━━━━\n`;
  msg += `الإجمالي: ${total} ج.م\n`;
  msg += `الاسم: ${name}\n`;
  msg += `الهاتف: ${phoneCheck.full}\n`;
  msg += `المنطقة: ${city}\n`;
  msg += `العنوان: ${address}\n`;
  msg += `الدفع: ${payment}\n`;
  if (notes) msg += `ملاحظات: ${notes}\n`;
  
  cart = [];
  saveCart();
  renderCart();
  updateCartCount();
  closeModal('orderModal');
  showToast('تم إرسال الطلب بنجاح');
  playSound();
  
  window.open(`https://wa.me/${storeConfig.phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

// =====================================================
// طلبات العميل
// =====================================================
function getStatusInfo(s) {
  return {
    'new': { label: 'جديد', class: 'status-new' },
    'processing': { label: 'قيد التنفيذ', class: 'status-processing' },
    'completed': { label: 'مكتمل', class: 'status-completed' },
    'cancelled': { label: 'ملغي', class: 'status-cancelled' }
  }[s] || { label: 'جديد', class: 'status-new' };
}

async function renderCustomerOrders() {
  const container = document.getElementById('completedOrdersList');
  if (!container) return;
  
  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';
  
  const list = await loadOrdersFromFirebase('all');
  
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>لا توجد طلبات حتى الآن</p></div>';
    return;
  }
  
  container.innerHTML = list.map(order => {
    const status = getStatusInfo(order.status);
    const date = toDate(order.createdAt) || new Date(order.createdAtLocal || 0);
    
    return `
      <div class="order-card order-status-${order.status || 'new'}">
        <div class="order-card-head">
          <span class="order-id">${escapeHtml(order.orderId || ('#' + (order.firestoreId || '').slice(-4)))}</span>
          <span class="order-status-badge ${status.class}">${status.label}</span>
          <span class="order-date">${date.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
        <div class="order-meta">
          <span><i class="fas fa-user"></i> ${escapeHtml(order.customerName)}</span>
          <span><i class="fas fa-phone"></i> ${escapeHtml(order.customerPhoneLocal || order.customerPhone)}</span>
        </div>
        <div class="order-items">${escapeHtml(order.summary || '')}</div>
        <div class="order-total-row">
          <span>الإجمالي</span>
          <span>${formatPrice(order.total)} ج.م</span>
        </div>
      </div>
    `;
  }).join('');
}

// =====================================================
// Modals
// =====================================================
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

function showConfirm(msg, onYes) {
  const modal = document.getElementById('customConfirmModal');
  const msgEl = document.getElementById('confirmMessage');
  const yesBtn = document.getElementById('confirmYesBtn');
  const noBtn = document.getElementById('confirmNoBtn');
  if (!modal) return;
  
  msgEl.textContent = msg;
  modal.classList.add('show');
  
  const ny = yesBtn.cloneNode(true);
  const nn = noBtn.cloneNode(true);
  yesBtn.parentNode.replaceChild(ny, yesBtn);
  noBtn.parentNode.replaceChild(nn, noBtn);
  
  ny.onclick = () => { modal.classList.remove('show'); onYes && onYes(); };
  nn.onclick = () => modal.classList.remove('show');
}

// =====================================================
// Cart
// =====================================================
function openCart() {
  document.getElementById('cartSidebar')?.classList.add('open');
  document.getElementById('cartOverlay')?.classList.add('show');
}
function closeCart() {
  document.getElementById('cartSidebar')?.classList.remove('open');
  document.getElementById('cartOverlay')?.classList.remove('show');
}

// =====================================================
// Dark mode
// =====================================================
function setupDarkMode() {
  const isDark = localStorage.getItem(STORAGE_KEYS.darkMode) === 'true';
  if (isDark) {
    document.body.classList.add('dark-mode');
    const t = document.getElementById('darkModeToggle');
    if (t) t.innerHTML = '<i class="fas fa-sun"></i>';
  }
  
  document.getElementById('darkModeToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const now = document.body.classList.contains('dark-mode');
    localStorage.setItem(STORAGE_KEYS.darkMode, now);
    const t = document.getElementById('darkModeToggle');
    if (t) t.innerHTML = now ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  });
}

// =====================================================
// Phone input
// =====================================================
function setupPhoneInput() {
  const input = document.getElementById('customerPhone');
  const hint = document.getElementById('phoneHint');
  const wrap = input?.closest('.phone-input-wrap');
  if (!input || !hint || !wrap) return;
  
  input.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
    const v = e.target.value;
    wrap.classList.remove('valid', 'invalid');
    hint.classList.remove('valid', 'invalid');
    if (!v) { hint.textContent = ''; return; }
    const check = validatePhone(v);
    if (check.valid) {
      wrap.classList.add('valid');
      hint.classList.add('valid');
      hint.textContent = `رقم ${check.network} صحيح`;
    } else {
      wrap.classList.add('invalid');
      hint.classList.add('invalid');
      hint.textContent = check.reason || '';
    }
  });
}

// =====================================================
// Areas
// =====================================================
const areas = ["مدينة نصر", "المعادي", "الدقي", "المهندسين", "الزمالك", "مصر الجديدة", "شبرا", "حلوان", "المقطم", "التجمع الخامس", "الشيخ زايد", "6 أكتوبر", "العبور", "عين شمس", "المطرية"];
function populateAreas() {
  const select = document.getElementById('city');
  if (!select) return;
  select.innerHTML = '<option value="">اختر المنطقة</option>';
  areas.forEach(a => {
    const o = document.createElement('option');
    o.value = a;
    o.textContent = a;
    select.appendChild(o);
  });
}

// =====================================================
// Scroll top
// =====================================================
function setupScrollTop() {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 400));
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// =====================================================
// Page Navigation
// =====================================================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
  const target = document.getElementById(`${pageId}Page`);
  if (target) target.classList.add('active-page');
  
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === pageId);
  });
  
  if (pageId === 'home') { renderFeatured(); renderProducts(); }
  if (pageId === 'new') renderNewArrivals();
  if (pageId === 'offers') renderOffers();
  if (pageId === 'favorites') renderFavorites();
  if (pageId === 'orders') renderCustomerOrders();
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================================================
// Admin — Login
// =====================================================
function setupAdminLogin() {
  document.getElementById('adminLoginBtn')?.addEventListener('click', () => showAdminLoginModal());
}

function showAdminLoginModal() {
  const existing = document.getElementById('adminLoginModal');
  if (existing) existing.remove();
  
  const savedEmail = localStorage.getItem('qattan_savedEmail') || '';
  
  const modal = document.createElement('div');
  modal.id = 'adminLoginModal';
  modal.className = 'modal show';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:400px;">
      <div class="modal-header">
        <h3><i class="fas fa-lock"></i> دخول الأدمن</h3>
        <span class="modal-close" id="closeAdminLogin">&times;</span>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>البريد الإلكتروني</label>
          <input type="email" id="adminEmail" class="modal-input" value="${escapeHtml(savedEmail)}" placeholder="email@gmail.com">
        </div>
        <div class="form-group">
          <label>كلمة السر</label>
          <input type="password" id="adminPassword" class="modal-input" placeholder="كلمة السر">
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;margin-top:10px;">
          <input type="checkbox" id="rememberMe" style="width:18px;height:18px;cursor:pointer;accent-color:var(--accent);" ${savedEmail ? 'checked' : ''}>
          <label for="rememberMe" style="margin:0;cursor:pointer;font-size:0.9rem;">تذكرني</label>
        </div>
        <div id="adminLoginError" style="color:#e74c3c;font-size:0.85rem;margin-top:8px;display:none;"></div>
      </div>
      <div class="modal-footer">
        <button id="submitAdminLogin" class="btn-primary" style="width:100%;">دخول</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  modal.querySelector('#closeAdminLogin').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  const submit = modal.querySelector('#submitAdminLogin');
  const email = modal.querySelector('#adminEmail');
  const pass = modal.querySelector('#adminPassword');
  const remember = modal.querySelector('#rememberMe');
  const err = modal.querySelector('#adminLoginError');
  
  submit.onclick = async () => {
    const em = email.value.trim();
    const pw = pass.value;
    if (!em || !pw) { err.textContent = 'أدخل البيانات'; err.style.display = 'block'; return; }
    
    err.style.display = 'none';
    submit.disabled = true;
    submit.textContent = 'جاري الدخول...';
    
    try {
      const cred = await signInWithEmailAndPassword(auth, em, pw);
      if (cred.user.email === ADMIN_EMAIL) {
        if (remember.checked) localStorage.setItem('qattan_savedEmail', em);
        else localStorage.removeItem('qattan_savedEmail');
        
        isAdminLoggedIn = true;
        document.body.classList.add('admin-logged-in');
        modal.remove();
        showAdminDashboard();
        showToast('تم تسجيل الدخول');
      } else {
        err.textContent = 'غير مصرح';
        err.style.display = 'block';
        await signOut(auth);
      }
    } catch (e) {
      let m = 'خطأ في الدخول';
      if (e.code === 'auth/user-not-found') m = 'الحساب غير موجود';
      else if (e.code === 'auth/wrong-password') m = 'كلمة السر خطأ';
      else if (e.code === 'auth/invalid-email') m = 'إيميل غير صالح';
      err.textContent = m;
      err.style.display = 'block';
    } finally {
      submit.disabled = false;
      submit.textContent = 'دخول';
    }
  };
  
  pass.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit.click(); });
}

// =====================================================
// Admin — Dashboard
// =====================================================
function closeAdminDashboard() {
  document.querySelectorAll('.admin-panel-overlay').forEach(el => el.remove());
  document.body.classList.remove('admin-open');
  document.body.style.overflow = 'auto'; // إرجاع السكرول
}

function showAdminDashboard() {
  document.querySelectorAll('.admin-panel-overlay').forEach(el => el.remove());
  document.body.classList.add('admin-open');
  document.body.style.overflow = 'hidden'; // منع السكرول في الخلفية
  
  const overlay = document.createElement('div');
  overlay.className = 'admin-panel-overlay show';
  overlay.innerHTML = `
    <div class="admin-dashboard">
      <div class="admin-top">
        <h2><i class="fas fa-store" style="color:var(--accent);margin-left:10px;"></i> لوحة تحكم قطان</h2>
        <button id="closeAdminDash" class="admin-close-btn"><i class="fas fa-times"></i> إغلاق اللوحة</button>
      </div>
      
      <div class="admin-tabs">
        <button class="admin-tab-btn active" data-tab="store"><i class="fas fa-cog"></i> إعدادات المتجر</button>
        <button class="admin-tab-btn" data-tab="products"><i class="fas fa-tshirt"></i> المنتجات</button>
        <button class="admin-tab-btn" data-tab="offers"><i class="fas fa-tags"></i> العروض</button>
        <button class="admin-tab-btn" data-tab="orders"><i class="fas fa-shopping-bag"></i> الطلبات</button>
        <button class="admin-tab-btn" data-tab="reviews"><i class="fas fa-comments"></i> التقييمات</button>
      </div>
      
      <div id="tab-store" class="admin-tab-content active-tab">
        <div class="admin-section">
          <h3><i class="fas fa-store"></i> بيانات المتجر</h3>
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">اسم المتجر</label>
          <input type="text" id="editName" class="admin-input" value="${escapeHtml(storeConfig.name)}">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">رقم الواتساب</label>
          <input type="text" id="editPhone" class="admin-input" value="${escapeHtml(storeConfig.phone)}" placeholder="2010...">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">العنوان</label>
          <input type="text" id="editAddress" class="admin-input" value="${escapeHtml(storeConfig.address)}">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">ساعات العمل</label>
          <input type="text" id="editHours" class="admin-input" value="${escapeHtml(storeConfig.workingHours)}">
          
          <button id="saveStoreBtn" class="admin-btn" style="width:100%;justify-content:center;margin-top:10px;">
            <i class="fas fa-save"></i> حفظ الإعدادات
          </button>
        </div>
      </div>
      
      <div id="tab-products" class="admin-tab-content">
        <div class="admin-section">
          <h3><i class="fas fa-plus-circle"></i> إضافة منتج جديد</h3>
          <div class="admin-grid-2">
            <div>
              <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">اسم المنتج</label>
              <input type="text" id="newName" class="admin-input" placeholder="مثال: تيشيرت قطن">
            </div>
            <div>
              <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">السعر</label>
              <input type="number" id="newPrice" class="admin-input" placeholder="350">
            </div>
            <div>
              <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">سعر العرض (اختياري)</label>
              <input type="number" id="newOfferPrice" class="admin-input" placeholder="0">
            </div>
            <div>
              <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">الفئة</label>
              <select id="newCategory" class="admin-input">
                <option value="men">رجالي</option>
                <option value="women">حريمي</option>
                <option value="kids">ولادي</option>
              </select>
            </div>
          </div>
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">الوصف</label>
          <textarea id="newDesc" class="admin-input" rows="3" placeholder="وصف المنتج..."></textarea>
          
          <div class="image-upload-section">
            <button type="button" id="uploadImgBtn" class="upload-btn"><i class="fas fa-upload"></i> رفع صورة</button>
            <button type="button" id="pasteImgBtn" class="paste-btn"><i class="fas fa-paste"></i> لصق صورة (Ctrl+V)</button>
          </div>
          <input type="file" id="newImgFile" accept="image/*" style="display:none;">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">أو رابط الصورة</label>
          <input type="text" id="newImgUrl" class="admin-input" placeholder="https://...">
          
          <img id="newImgPreview" style="display:none;width:100px;height:130px;object-fit:cover;border-radius:12px;margin:10px 0;border:2px solid var(--border-color);">
          
          <button id="addProductBtn" class="admin-btn" style="width:100%;justify-content:center;">
            <i class="fas fa-plus"></i> إضافة المنتج
          </button>
        </div>
        
        <div class="admin-section">
          <h3><i class="fas fa-list"></i> المنتجات الحالية</h3>
          <div id="productsListAdmin"></div>
        </div>
      </div>
      
      <div id="tab-offers" class="admin-tab-content">
        <div class="admin-section">
          <h3><i class="fas fa-plus-circle"></i> إضافة عرض جديد</h3>
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">عنوان العرض</label>
          <input type="text" id="newOfferTitle" class="admin-input" placeholder="خصم 20%">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">الوصف</label>
          <textarea id="newOfferDesc" class="admin-input" rows="2"></textarea>
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">نص التاج (مثال: خصم 20%)</label>
          <input type="text" id="newOfferTag" class="admin-input">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">اختر المنتج</label>
          <select id="newOfferProduct" class="admin-input"></select>
          
          <button id="addOfferBtn" class="admin-btn" style="width:100%;justify-content:center;">
            <i class="fas fa-plus"></i> إضافة العرض
          </button>
        </div>
        
        <div class="admin-section">
          <h3><i class="fas fa-list"></i> العروض الحالية</h3>
          <div id="offersListAdmin"></div>
        </div>
      </div>
      
      <div id="tab-orders" class="admin-tab-content">
        <div class="admin-section">
          <h3><i class="fas fa-shopping-bag"></i> الطلبات الواردة</h3>
          <div class="orders-filter-bar">
            <button class="orders-filter-btn active" data-filter="all">كل الطلبات</button>
            <button class="orders-filter-btn" data-filter="today">اليوم</button>
            <button class="orders-filter-btn" data-filter="week">آخر 7 أيام</button>
            <button class="orders-filter-btn" data-filter="month">آخر 30 يوم</button>
          </div>
          <div id="ordersListAdmin"></div>
        </div>
      </div>

      <div id="tab-reviews" class="admin-tab-content">
        <div class="admin-section">
          <h3><i class="fas fa-comments"></i> تقييمات العملاء</h3>
          <div id="reviewsListAdmin"></div>
        </div>
      </div>
      
    </div>
  `;
  document.body.appendChild(overlay);
  
  overlay.querySelector('#closeAdminDash').onclick = () => {
    overlay.remove();
    signOut(auth).catch(() => {});
    isAdminLoggedIn = false;
    document.body.classList.remove('admin-logged-in');
    document.body.style.overflow = 'auto';
  };
  
  overlay.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      overlay.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active-tab'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById(`tab-${tab}`).classList.add('active-tab');
      
      if (tab === 'products') renderProductsAdmin();
      if (tab === 'offers') { renderOffersAdmin(); populateOfferProductSelect(); }
      if (tab === 'orders') renderOrdersAdmin();
      if (tab === 'reviews') renderReviewsAdmin();
    });
  });
  
  overlay.querySelector('#saveStoreBtn').onclick = async () => {
    storeConfig.name = overlay.querySelector('#editName').value.trim();
    storeConfig.phone = overlay.querySelector('#editPhone').value.trim();
    storeConfig.address = overlay.querySelector('#editAddress').value.trim();
    storeConfig.workingHours = overlay.querySelector('#editHours').value.trim();
    
    const btn = overlay.querySelector('#saveStoreBtn');
    btn.disabled = true;
    btn.innerHTML = 'جاري الحفظ...';
    await saveStoreData();
    applyStoreConfig();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ الإعدادات';
    showToast('تم حفظ الإعدادات');
  };
  
  let pendingImgData = null;
  overlay.querySelector('#uploadImgBtn').onclick = () => overlay.querySelector('#newImgFile').click();
  overlay.querySelector('#newImgFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    pendingImgData = await fileToBase64(f);
    const prev = overlay.querySelector('#newImgPreview');
    prev.src = pendingImgData;
    prev.style.display = 'block';
  };
  
  overlay.querySelector('#pasteImgBtn').onclick = () => {
    showToast('الصق الصورة بـ Ctrl+V');
    const handler = async (e) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const f = items[i].getAsFile();
          pendingImgData = await fileToBase64(f);
          const prev = overlay.querySelector('#newImgPreview');
          prev.src = pendingImgData;
          prev.style.display = 'block';
          showToast('تم لصق الصورة');
          document.removeEventListener('paste', handler);
          break;
        }
      }
    };
    document.addEventListener('paste', handler);
    setTimeout(() => document.removeEventListener('paste', handler), 10000);
  };
  
  overlay.querySelector('#addProductBtn').onclick = async () => {
    const name = overlay.querySelector('#newName').value.trim();
    const price = parseFloat(overlay.querySelector('#newPrice').value);
    const offerPrice = overlay.querySelector('#newOfferPrice').value ? parseFloat(overlay.querySelector('#newOfferPrice').value) : null;
    const category = overlay.querySelector('#newCategory').value;
    const desc = overlay.querySelector('#newDesc').value.trim();
    const imgUrl = overlay.querySelector('#newImgUrl').value.trim();
    const imgData = pendingImgData || imgUrl;
    
    if (!name || isNaN(price)) { showToast('أدخل الاسم والسعر'); return; }
    
    const sizesMap = { men: ['S','M','L','XL','XXL'], women: ['XS','S','M','L','XL'], kids: ['2-3 سنوات','4-5 سنوات','6-7 سنوات','8-9 سنوات'] };
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    
    products.push({
      id: newId, name, category, price, offerPrice,
      image: imgData || '', gallery: [], description: desc,
      sizes: sizesMap[category] || [], colors: [{name:'أسود',hex:'#1a1a1a'},{name:'أبيض',hex:'#ffffff'}],
      isFeatured: false, isNew: true, ratings: [], avgRating: 0, totalRatings: 0, isAvailable: true
    });
    
    const btn = overlay.querySelector('#addProductBtn');
    btn.disabled = true;
    btn.innerHTML = 'جاري الحفظ...';
    await saveStoreData();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-plus"></i> إضافة المنتج';
    
    pendingImgData = null;
    overlay.querySelector('#newName').value = '';
    overlay.querySelector('#newPrice').value = '';
    overlay.querySelector('#newImgPreview').style.display = 'none';
    
    renderProductsAdmin();
    renderProducts();
    renderFeatured();
    renderNewArrivals();
    showToast('تم إضافة المنتج');
  };
  
  overlay.querySelector('#addOfferBtn').onclick = async () => {
    const title = overlay.querySelector('#newOfferTitle').value.trim();
    const pid = parseInt(overlay.querySelector('#newOfferProduct').value);
    
    if (!title || !pid) { showToast('أدخل البيانات'); return; }
    
    offers.push({ id: 'off_' + Date.now(), title, productId: pid, isAvailable: true });
    
    const btn = overlay.querySelector('#addOfferBtn');
    btn.disabled = true;
    btn.innerHTML = 'جاري الحفظ...';
    await saveStoreData();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-plus"></i> إضافة العرض';
    
    renderOffersAdmin();
    renderOffers();
    showToast('تم إضافة العرض');
  };
  
  function renderProductsAdmin() {
    const cont = overlay.querySelector('#productsListAdmin');
    if (products.length === 0) { cont.innerHTML = '<p style="text-align:center;padding:20px;">لا توجد منتجات</p>'; return; }
    
    cont.innerHTML = products.map(p => `
      <div class="admin-product-row">
        <img src="${escapeHtml(buildImageUrl(p.image, p.name))}" class="admin-product-img">
        <div class="admin-product-info">
          <strong>${escapeHtml(p.name)}</strong>
          <span>${formatPrice(p.price)} ج.م — ${categoryLabels[p.category]}</span>
        </div>
        <button class="admin-del-btn" data-del="${p.id}"><i class="fas fa-trash"></i> حذف</button>
      </div>
    `).join('');
    
    cont.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.del);
        showConfirm('حذف المنتج نهائياً؟', async () => {
          products = products.filter(p => p.id !== id);
          await saveStoreData();
          renderProductsAdmin();
          renderProducts();
          renderFeatured();
          renderNewArrivals();
          showToast('تم الحذف');
        });
      };
    });
  }
  
  function populateOfferProductSelect() {
    const sel = overlay.querySelector('#newOfferProduct');
    sel.innerHTML = products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }
  
  function renderOffersAdmin() {
    const cont = overlay.querySelector('#offersListAdmin');
    if (offers.length === 0) { cont.innerHTML = '<p style="text-align:center;padding:20px;">لا توجد عروض</p>'; return; }
    
    cont.innerHTML = offers.map(o => `
      <div class="admin-product-row">
        <div class="admin-product-info">
          <strong>${escapeHtml(o.title)}</strong>
          <span>${escapeHtml(o.tag || '')}</span>
        </div>
        <button class="admin-del-btn" data-del="${o.id}"><i class="fas fa-trash"></i> حذف</button>
      </div>
    `).join('');
    
    cont.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.del;
        showConfirm('حذف العرض؟', async () => {
          offers = offers.filter(o => o.id !== id);
          await saveStoreData();
          renderOffersAdmin();
          renderOffers();
          showToast('تم الحذف');
        });
      };
    });
  }
  
  async function renderOrdersAdmin() {
    const cont = overlay.querySelector('#ordersListAdmin');
    cont.innerHTML = '<p style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</p>';
    
    const list = await loadOrdersFromFirebase(currentOrdersFilter);
    
    if (list.length === 0) { cont.innerHTML = '<p style="text-align:center;padding:20px;">لا توجد طلبات</p>'; return; }
    
    cont.innerHTML = list.map(o => {
      const status = getStatusInfo(o.status);
      const date = toDate(o.createdAt) || new Date(o.createdAtLocal || 0);
      return `
        <div class="admin-order-card">
          <div style="display:flex;justify-content:space-between;margin-bottom:10px;align-items:center;">
            <strong style="font-size:1.1rem;">${escapeHtml(o.customerName)}</strong>
            <span class="order-status-badge ${status.class}">${status.label}</span>
          </div>
          <div style="font-size:0.9rem;color:var(--text-soft);margin-bottom:8px;">
            <i class="fas fa-phone"></i> ${escapeHtml(o.customerPhoneLocal || '')} | <i class="fas fa-map-marker-alt"></i> ${escapeHtml(o.fullAddress || '')}
          </div>
          <div style="background:var(--bg-soft);padding:10px;border-radius:8px;margin-bottom:10px;">${escapeHtml(o.summary || '')}</div>
          <div style="font-weight:800;font-size:1.1rem;margin-bottom:15px;">${formatPrice(o.total)} ج.م</div>
          
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${o.status !== 'processing' ? `<button data-status="processing" data-oid="${o.firestoreId}" class="status-btn admin-btn" style="background:#3498db;padding:8px 15px;font-size:0.8rem;">قيد التنفيذ</button>` : ''}
            ${o.status !== 'completed' ? `<button data-status="completed" data-oid="${o.firestoreId}" class="status-btn admin-btn" style="background:#27ae60;padding:8px 15px;font-size:0.8rem;">مكتمل</button>` : ''}
            ${o.status !== 'cancelled' ? `<button data-status="cancelled" data-oid="${o.firestoreId}" class="status-btn admin-btn" style="background:#e74c3c;padding:8px 15px;font-size:0.8rem;">إلغاء</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    cont.querySelectorAll('.status-btn').forEach(btn => {
      btn.onclick = async () => {
        const oid = btn.dataset.oid;
        const st = btn.dataset.status;
        await updateOrderStatusInFirebase(oid, st);
        renderOrdersAdmin();
        showToast('تم تحديث الحالة');
      };
    });
  }
  
  overlay.querySelectorAll('.orders-filter-btn').forEach(btn => {
    btn.onclick = () => {
      overlay.querySelectorAll('.orders-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentOrdersFilter = btn.dataset.filter;
      renderOrdersAdmin();
    };
  });

  // ✅ دالة عرض التقييمات في لوحة التحكم
  function renderReviewsAdmin() {
    const cont = overlay.querySelector('#reviewsListAdmin');
    if (!cont) return;
    
    let allReviews = [];
    products.forEach(p => {
      if (p.ratings && p.ratings.length > 0) {
        p.ratings.forEach((r, idx) => {
          allReviews.push({ productId: p.id, productName: p.name, reviewIdx: idx, review: r });
        });
      }
    });
    
    if (allReviews.length === 0) {
      cont.innerHTML = '<p style="text-align:center; padding:20px;">لا توجد تقييمات حتى الآن</p>';
      return;
    }
    
    allReviews.sort((a, b) => new Date(b.review.date) - new Date(a.review.date));
    
    cont.innerHTML = allReviews.map(item => {
      const repliesHtml = (item.review.replies && item.review.replies.length > 0) ? item.review.replies.map(reply => `
        <div class="reply-item store-reply" style="margin-bottom:8px;">
          <strong style="font-size:0.8rem; display:block; margin-bottom:3px;">المتجر (إدارة):</strong>
          <span style="font-size:0.9rem;">${escapeHtml(reply.text)}</span>
        </div>
      `).join('') : '';
      
      return `
        <div class="admin-review-card">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <strong style="color:var(--accent);">${escapeHtml(item.productName)}</strong>
            <span style="font-size:0.75rem; opacity:0.6;">${new Date(item.review.date).toLocaleDateString('ar-EG')}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span style="font-weight:700; font-size:0.9rem;">${escapeHtml(item.review.userName)}</span>
            <div class="stars">${renderStars(item.review.rating)}</div>
          </div>
          ${item.review.comment ? `<p style="font-size:0.9rem; margin-bottom:10px; color:var(--text-soft);">${escapeHtml(item.review.comment)}</p>` : ''}
          
          ${repliesHtml}
          
          <div class="admin-reply-box">
            <input type="text" placeholder="اكتب ردك هنا..." class="admin-reply-input" data-pid="${item.productId}" data-ridx="${item.reviewIdx}">
            <button class="admin-reply-btn" data-pid="${item.productId}" data-ridx="${item.reviewIdx}">رد</button>
          </div>
        </div>
      `;
    }).join('');
    
    cont.querySelectorAll('.admin-reply-btn').forEach(btn => {
      btn.onclick = async () => {
        const pid = parseInt(btn.dataset.pid);
        const ridx = parseInt(btn.dataset.ridx);
        const input = cont.querySelector(`.admin-reply-input[data-pid="${pid}"][data-ridx="${ridx}"]`);
        const text = input?.value.trim();
        
        if (!text) { showToast('أدخل نص الرد'); return; }
        
        const product = products.find(p => p.id === pid);
        if (product && product.ratings && product.ratings[ridx]) {
          if (!product.ratings[ridx].replies) product.ratings[ridx].replies = [];
          product.ratings[ridx].replies.push({ text, userName: "المتجر", date: new Date().toISOString() });
          
          btn.disabled = true;
          btn.textContent = '...';
          await saveStoreData();
          renderReviewsAdmin();
          showToast('تم إضافة الرد بنجاح');
        }
      };
    });
  }
  
  renderProductsAdmin();
  populateOfferProductSelect();
}

// =====================================================
// Init
// =====================================================
async function init() {
  document.body.style.overflow = 'auto'; // ضمان السكرول في البداية
  
  loadLocalState();
  setupDarkMode();
  setupPhoneInput();
  populateAreas();
  setupScrollTop();
  
  await loadStoreData();
  
  applyStoreConfig();
  renderFeatured();
  renderProducts();
  renderCart();
  updateCartCount();
  
  // =====================================================
  // إعداد القائمة الجانبية وزرار الرجوع (Routing)
  // =====================================================
  const navLinks = document.querySelector('.nav-links');
  const menuToggle = document.getElementById('menuToggle');
  
  const navOverlay = document.createElement('div');
  navOverlay.className = 'nav-overlay';
  document.body.appendChild(navOverlay);

  function openMobileMenu() {
    navLinks?.classList.add('active');
    navOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    navLinks?.classList.remove('active');
    navOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
  }

  menuToggle?.addEventListener('click', openMobileMenu);
  navOverlay.addEventListener('click', closeMobileMenu);

  function navigateToPage(pageId) {
    showPage(pageId);
    closeMobileMenu();
    window.history.pushState({ page: pageId }, '', window.location.href);
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateToPage(btn.dataset.page));
  });

  window.addEventListener('popstate', (e) => {
    if (navLinks?.classList.contains('active')) {
      closeMobileMenu();
      return;
    }
    
    if (e.state && e.state.page) {
      showPage(e.state.page);
    } else {
      showPage('home');
    }
    
    const currentPage = e.state?.page || 'home';
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.page === currentPage);
    });
  });

  window.history.replaceState({ page: 'home' }, '', window.location.href);
  
  // =====================================================
  // ربط باقي الأزرار
  // =====================================================
  document.getElementById('heroShopBtn')?.addEventListener('click', () => {
    document.querySelector('.section')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('heroNewBtn')?.addEventListener('click', () => {
    navigateToPage('new');
  });
  
  document.querySelectorAll('.section-link[data-page]').forEach(l => {
    l.addEventListener('click', (e) => { e.preventDefault(); navigateToPage(l.dataset.page); });
  });
  document.querySelectorAll('.breadcrumbs a[data-page]').forEach(l => {
    l.addEventListener('click', (e) => { e.preventDefault(); navigateToPage(l.dataset.page); });
  });
  
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCategory = btn.dataset.cat;
      document.querySelectorAll('.cat-pill').forEach(b => {
        b.classList.toggle('active-cat', b.dataset.cat === currentCategory);
      });
      renderProducts();
    });
  });
  
  document.getElementById('menuSearch')?.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    renderProducts();
  });
  
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    currentSortValue = e.target.value;
    renderProducts();
  });
  
  document.getElementById('cartIcon')?.addEventListener('click', openCart);
  document.getElementById('closeCartBtn')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
  
  document.getElementById('clearCartBtn')?.addEventListener('click', () => {
    if (cart.length === 0) return;
    showConfirm('تفريغ السلة؟', () => {
      cart = [];
      saveCart();
      renderCart();
      updateCartCount();
      showToast('تم التفريغ');
    });
  });
  
  document.getElementById('confirmOrderBtn')?.addEventListener('click', () => {
    if (cart.length === 0) { showToast('السلة فارغة'); return; }
    closeCart();
    setTimeout(() => document.getElementById('orderModal').classList.add('show'), 250);
  });
  
  document.getElementById('closeOrderModalBtn')?.addEventListener('click', () => closeModal('orderModal'));
  document.getElementById('sendWhatsAppBtn')?.addEventListener('click', sendOrder);
  
  document.getElementById('closeQuickViewBtn')?.addEventListener('click', () => closeModal('quickViewModal'));
  document.getElementById('quickViewModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'quickViewModal') closeModal('quickViewModal');
  });
  
  document.getElementById('closeSizeGuideBtn')?.addEventListener('click', () => closeModal('sizeGuideModal'));
  document.getElementById('sizeGuideModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'sizeGuideModal') closeModal('sizeGuideModal');
  });
  
  document.getElementById('refreshOrdersBtn')?.addEventListener('click', () => {
    renderCustomerOrders();
    showToast('تم التحديث');
  });
  
  setupAdminLogin();
  
  setTimeout(() => {
    const loader = document.getElementById('pageLoader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 400);
    }
    document.body.style.visibility = 'visible';
  }, 400);
}

init();