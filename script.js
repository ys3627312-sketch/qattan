// =====================================================
// QATTAN — Store Script (Firebase Edition — URLs Only)
// =====================================================

let threeScene, threeCamera, threeRenderer, threeControls;
let mannequinModel = null;
let selectedTshirt = null;
let selectedPants = null;

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc,
  collection, addDoc, getDocs, updateDoc,
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
let bundles = [];
let cart = [];
let favorites = [];

let currentCategory = 'tshirts';
let currentSearchQuery = '';
let currentSortValue = 'default';
let lastProductId = null;

let isAdminLoggedIn = false;
let currentOrdersFilter = 'all';

const STORAGE_KEYS = {
  cart: 'qattan_cart',
  favorites: 'qattan_favorites',
  darkMode: 'qattan_darkMode',
  lastProduct: 'qattan_lastProduct',
  clientId: 'qattan_clientId'
};

const MAX_QTY = 10;

const AVAILABLE_COLORS = [
  { id: 'black', name: 'أسود', hex: '#1a1a1a' },
  { id: 'white', name: 'أبيض', hex: '#ffffff' },
  { id: 'blue', name: 'أزرق', hex: '#3498db' },
  { id: 'red', name: 'أحمر', hex: '#e74c3c' },
  { id: 'green', name: 'أخضر', hex: '#27ae60' },
  { id: 'yellow', name: 'أصفر', hex: '#f1c40f' },
  { id: 'navy', name: 'كحلي', hex: '#34495e' },
  { id: 'gray', name: 'رمادي', hex: '#7f8c8d' },
  { id: 'beige', name: 'بيج', hex: '#d4c4a8' },
  { id: 'brown', name: 'بني', hex: '#8b5a2b' },
  { id: 'pink', name: 'وردي', hex: '#e91e63' },
  { id: 'purple', name: 'بنفسجي', hex: '#9b59b6' },
  { id: 'orange', name: 'برتقالي', hex: '#e67e22' }
];

const colorHexMap = AVAILABLE_COLORS.reduce((acc, c) => {
  acc[c.name] = c.hex;
  return acc;
}, {});

// =====================================================
// Client ID
// =====================================================
function getClientId() {
  let id = localStorage.getItem(STORAGE_KEYS.clientId);
  if (!id) {
    id = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(STORAGE_KEYS.clientId, id);
  }
  return id;
}

// =====================================================
// أدوات مساعدة
// =====================================================
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
  if (audio) { 
    audio.currentTime = 0; 
    audio.play().catch(() => {}); 
  }
}

function buildImageUrl(url, name) {
  if (!url || !url.trim()) {
    return `https://placehold.co/400x533/f0ebe1/1a1a1a?text=${encodeURIComponent(name || 'منتج')}`;
  }
  return url;
}

function restoreScroll() {
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.classList.remove('admin-open');
  document.body.classList.remove('admin-logged-in');
}

// =====================================================
// الحفظ والتحميل
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
  } catch(e) { 
    console.error('loadLocalState error:', e); 
  }
}

// =====================================================
// Firebase — Store Data
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
      if (Array.isArray(data.bundles)) bundles = data.bundles;
    }
  } catch (e) {
    console.error('loadStoreData error:', e);
  }
}

async function saveStoreData() {
  try {
    const docRef = doc(db, 'storeData', 'main');
    await setDoc(docRef, { storeConfig, products, offers, bundles });
    console.log('✅ Store data saved successfully');
    return true;
  } catch (e) {
    console.error('❌ saveStoreData error:', e);
    let msg = 'فشل الحفظ في Firebase';
    if (e.code === 'permission-denied') {
      msg = 'غير مصرح بالحفظ — سجل دخول الأدمن تاني';
    } else if (e.code === 'unavailable') {
      msg = 'مشكلة في الاتصال — جرب تاني';
    }
    showToast(msg);
    return false;
  }
}

// =====================================================
// Firebase — Orders
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

async function loadOrdersFromFirebase(filterType, onlyMyOrders = false) {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    let list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
    
    if (onlyMyOrders) {
      const myId = getClientId();
      list = list.filter(o => o.clientId === myId);
    }
    
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

// =====================================================
// إعدادات المتجر
// =====================================================
function applyStoreConfig() {
  document.title = storeConfig.name + ' | ملابس بجودة عالية';
  
  const el = document.getElementById('storeName');
  if (el) el.textContent = storeConfig.name;
  
  const drawerName = document.getElementById('drawerStoreName');
  if (drawerName) drawerName.textContent = storeConfig.name;
  
  const addr = document.getElementById('storeAddress');
  if (addr) addr.textContent = storeConfig.address;
  
  const hrs = document.getElementById('workingHours');
  if (hrs) hrs.textContent = storeConfig.workingHours;
  
  const phone = document.getElementById('footerPhone');
  if (phone) phone.textContent = (storeConfig.phone || '').replace(/^20/, '0');
  
  const waFab = document.getElementById('whatsappFab');
  if (waFab) {
    const rawPhone = storeConfig.phone || '201225899225';
    let num = String(rawPhone).replace(/[^0-9]/g, '');
    if (num && !num.startsWith('20')) num = '20' + num.replace(/^0+/, '');
    
    waFab.href = `https://wa.me/${num}`;
    waFab.target = '_blank';
    waFab.rel = 'noopener noreferrer';
  }
  
  const drawerPhone = document.getElementById('drawerPhone');
  if (drawerPhone) drawerPhone.textContent = (storeConfig.phone || '').replace(/^20/, '0');
  
  const footerText = document.getElementById('footerText');
  if (footerText) {
    footerText.textContent = `© 2025 ${storeConfig.name} | جميع الحقوق محفوظة`;
  }
}

// =====================================================
// عرض المنتجات
// =====================================================
const categoryLabels = { tshirts: 'تيشيرتات', pants: 'بناطيل', shoes: 'أحذية', all: 'الكل' };

function getFilteredProducts() {
  let list = [...products];
  
  if (currentCategory !== 'all') {
    list = list.filter(p => p.category === currentCategory);
  }
  
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
  if (!isAvail) {
    badge = '<span class="product-badge unavailable">غير متوفر</span>';
  } else if (hasOffer) {
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
  
  const featured = products.filter(p => p.isNew).slice(0, 4);
  
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
  
  if (bundles.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-tags"></i><p>لا توجد عروض حالياً</p></div>';
    return;
  }
  
  container.innerHTML = bundles.map(b => {
    let minPrice = 0;
    b.productSelections.forEach(sel => {
      const prod = products.find(p => p.id === sel.productId);
      if (prod) {
        let lowestPrice = Infinity;
        sel.sizes.forEach(s => {
          const qty = prod.sizeMatrix && prod.sizeMatrix[s] ? prod.sizeMatrix[s].qty : 0;
          const price = prod.sizeMatrix && prod.sizeMatrix[s] ? prod.sizeMatrix[s].price : prod.price;
          if (qty > 0 && price < lowestPrice) lowestPrice = price;
        });
        if (lowestPrice !== Infinity) minPrice += lowestPrice;
      }
    });
    
    const totalBeforeDiscount = minPrice * b.requiredCount;
    const finalPrice = totalBeforeDiscount - (totalBeforeDiscount * (b.discountPercent / 100));
    
    return `
      <div class="offer-card" style="background: linear-gradient(135deg, #fff8e1, #fdf2d0); border: 2px solid #f1c40f;">
        <span class="offer-tag" style="background:#e74c3c; color:#fff; font-size:0.9rem;">خصم ${b.discountPercent}%</span>
        <h3 class="offer-title" style="color:#b7330f;">${escapeHtml(b.title)}</h3>
        <p class="offer-desc" style="color:#7f5a1f; font-weight:600;">${escapeHtml(b.desc)}</p>
        <p style="font-size:0.9rem; color:#5a3d0c; margin-bottom:10px;">اطلب <strong>${b.requiredCount}</strong> قطعة بسعر مميز!</p>
        <button class="offer-action" data-bundle-id="${b.id}" style="background:#e74c3c; color:#fff;">اكتشف العرض</button>
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('.offer-action[data-bundle-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bid = btn.dataset.bundleId;
      showBundleDetails(bid);
    });
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
  if (idx === -1) { 
    favorites.push(id); 
    showToast('تمت الإضافة للمفضلة'); 
  } else { 
    favorites.splice(idx, 1); 
    showToast('تمت الإزالة من المفضلة'); 
  }
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
  const uniqueImgs = [...new Set(allImgs)];
  
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
        <img id="mainImage" src="${escapeHtml(buildImageUrl(uniqueImgs[0], p.name))}" alt="${escapeHtml(p.name)}">
      </div>
      ${uniqueImgs.length > 1 ? `
        <div class="product-gallery-thumbs">
          ${uniqueImgs.map((img, i) => `
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
      
      <div class="product-details-price ${hasOffer ? 'sale-price' : ''}" id="mainPriceDisplay">
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
            ${p.sizes.map((s, i) => {
              const matrix = p.sizeMatrix ? p.sizeMatrix[s] : null;
              const qty = matrix ? matrix.qty : (p.isAvailable === false ? 0 : 999);
              const isOut = qty <= 0;
              return `
                <button class="size-pill ${i === 0 && !isOut ? 'selected' : ''} ${isOut ? 'out-of-stock' : ''}" 
                        data-size="${escapeHtml(s)}" ${isOut ? 'disabled' : ''}>
                  ${escapeHtml(s)}
                  ${isOut ? '<br><small style="font-size:0.65rem;">نفذ</small>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
        
        <div class="option-section" id="colorSection">
          <div class="option-header"><span class="option-label">اللون المتاح</span></div>
          <div class="color-selector" id="dynamicColors"></div>
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
  
  let selSize = null;
  let selColorName = null;
  
  if (p.sizes) {
    for (let s of p.sizes) {
      const matrix = p.sizeMatrix ? p.sizeMatrix[s] : null;
      const qty = matrix ? matrix.qty : (p.isAvailable === false ? 0 : 999);
      if (qty > 0) { selSize = s; break; }
    }
  }
  
  const priceDisplay = document.getElementById('mainPriceDisplay');
  const dynamicColors = document.getElementById('dynamicColors');
  
  function updatePriceAndColors(selectedSize) {
    if (!p.sizeMatrix || !p.sizeMatrix[selectedSize]) return;
    const matrix = p.sizeMatrix[selectedSize];
    
    if (priceDisplay) {
      priceDisplay.innerHTML = `${formatPrice(matrix.price)} ج.م`;
      if (hasOffer && p.offerPrice < p.price) {
        priceDisplay.innerHTML += ` <span class="old">${formatPrice(p.price)} ج.م</span>`;
      }
    }
    
    if (dynamicColors) {
      if (matrix.colors && matrix.colors.length > 0) {
        dynamicColors.innerHTML = matrix.colors.map((cName, i) => `
          <button class="color-swatch ${i === 0 ? 'selected' : ''}" 
            data-color-name="${escapeHtml(cName)}" 
            style="background:${colorHexMap[cName] || '#ccc'};" 
            title="${escapeHtml(cName)}"></button>
        `).join('');
        
        selColorName = matrix.colors[0];
        
        dynamicColors.querySelectorAll('.color-swatch').forEach(sw => {
          sw.addEventListener('click', () => {
            dynamicColors.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
            sw.classList.add('selected');
            selColorName = sw.dataset.colorName;
          });
        });
      } else {
        dynamicColors.innerHTML = '<p style="font-size:0.85rem;color:var(--danger);">لا توجد ألوان متاحة لهذا المقاس</p>';
        selColorName = null;
      }
    }
  }
  
  if (selSize) {
    updatePriceAndColors(selSize);
  }
  
  const mainImgEl = document.getElementById('mainImage');
  if (mainImgEl) {
    mainImgEl.style.cursor = 'zoom-in';
    mainImgEl.addEventListener('click', () => {
      openLightbox(mainImgEl.src);
    });
  }
  
  container.querySelectorAll('.size-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      container.querySelectorAll('.size-pill').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selSize = btn.dataset.size;
      updatePriceAndColors(selSize);
    });
  });
  
  container.querySelectorAll('.gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const idx = parseInt(thumb.dataset.imgIdx);
      const mainImg = document.getElementById('mainImage');
      if (mainImg) mainImg.src = buildImageUrl(uniqueImgs[idx], p.name);
      container.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });
  
  document.getElementById('addToCartBtn')?.addEventListener('click', () => {
    if (!selSize) {
      showToast('اختر مقاس أولاً');
      return;
    }
    const matrix = p.sizeMatrix ? p.sizeMatrix[selSize] : null;
    const customPrice = matrix ? matrix.price : p.price;
    const colorObj = selColorName ? { name: selColorName, hex: colorHexMap[selColorName] || '#000' } : null;
    
    addToCart(p, 1, selSize, colorObj, customPrice);
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
    
    const saved = await saveStoreData();
    if (saved) {
      showToast('شكراً لتقييمك!');
      playSound();
      renderProductDetails(p.id);
    }
  });
}

// =====================================================
// Lightbox
// =====================================================
function openLightbox(src) {
  let lightbox = document.getElementById('imageLightbox');
  
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'imageLightbox';
    lightbox.className = 'lightbox-overlay';
    lightbox.innerHTML = `
      <button class="lightbox-close" aria-label="إغلاق">
        <i class="fas fa-times"></i>
      </button>
      <img src="" alt="صورة المنتج">
    `;
    document.body.appendChild(lightbox);
    
    lightbox.querySelector('.lightbox-close').addEventListener('click', (e) => {
      e.stopPropagation();
      lightbox.classList.remove('show');
    });
    
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        lightbox.classList.remove('show');
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('show')) {
        lightbox.classList.remove('show');
      }
    });
  }
  
  const img = lightbox.querySelector('img');
  if (img) img.src = src;
  lightbox.classList.add('show');
}

// =====================================================
// السلة
// =====================================================
function addToCart(product, qty = 1, size = null, color = null, customPrice = null) {
  if (product.isAvailable === false) {
    showToast('هذا المنتج غير متوفر');
    return;
  }
  
  if (size && product.sizeMatrix) {
    const matrix = product.sizeMatrix[size];
    if (matrix && matrix.qty <= 0) {
      showToast('هذا المقاس غير متوفر');
      return;
    }
    // التحقق من الكمية المطلوبة
    const existingInCart = cart.filter(c => c.type !== 'bundle' && c.id === product.id && c.size === size).reduce((s, c) => s + c.quantity, 0);
    if (matrix && (existingInCart + qty) > matrix.qty) {
      showToast(`الكمية المتاحة ${matrix.qty} فقط`);
      return;
    }
  }
  
  const variantKey = `${product.id}_${size || ''}_${color?.name || ''}`;
  const existing = cart.find(c => c.type !== 'bundle' && c.variantKey === variantKey);
  const finalPrice = customPrice || product.offerPrice || product.price;
  
  if (existing) {
    if (existing.quantity + qty > MAX_QTY) {
      showToast(`لا يمكنك طلب أكثر من ${MAX_QTY} قطع`);
      return;
    }
    existing.quantity += qty;
  } else {
    cart.push({
      type: 'single',
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
  
  if (item.type === 'bundle') {
    return;
  }
  
  // التحقق من المخزون
  const product = products.find(p => p.id === item.id);
  if (product && item.size && product.sizeMatrix && product.sizeMatrix[item.size]) {
    const maxQty = product.sizeMatrix[item.size].qty;
    if (item.quantity + delta > maxQty) {
      showToast(`الكمية المتاحة ${maxQty} فقط`);
      return;
    }
  }
  
  const newQty = item.quantity + delta;
  if (newQty <= 0) { removeFromCart(key); return; }
  if (newQty > MAX_QTY) { showToast(`الحد الأقصى ${MAX_QTY}`); return; }
  item.quantity = newQty;
  saveCart();
  renderCart();
  updateCartCount();
}

function updateCartCount() {
  const count = cart.reduce((s, c) => s + (c.type === 'bundle' ? 1 : c.quantity), 0);
  const el = document.getElementById('cartCount');
  if (el) el.textContent = count;
}

function calcCartTotal() {
  return cart.reduce((s, c) => {
    if (c.type === 'bundle') return s + c.finalPrice;
    return s + c.price * c.quantity;
  }, 0);
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
  
  container.innerHTML = cart.map(item => {
    if (item.type === 'bundle') {
      return `
        <div class="cart-item bundle-cart-item" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:16px; padding:16px; margin-bottom:14px; position:relative; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
          
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:14px; padding-bottom:12px; border-bottom:1px dashed var(--border-color);">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <i class="fas fa-gift" style="color:var(--accent); font-size:1rem;"></i>
                <strong style="color:var(--text-color); font-size:1rem;">${escapeHtml(item.bundleTitle)}</strong>
              </div>
              <span style="font-size:0.75rem; color:var(--danger); font-weight:700; background:rgba(231,76,60,0.08); padding:2px 8px; border-radius:20px;">
                خصم ${item.discountPercent}%
              </span>
            </div>
            <button class="cart-remove" data-remove="${escapeHtml(item.variantKey)}" style="color:var(--text-soft); font-size:0.9rem; background:none; border:none; cursor:pointer;">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div style="margin-bottom:14px;">
            ${item.items.map(subItem => `
              <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--bg-soft);">
                <img src="${escapeHtml(buildImageUrl(subItem.productImage, subItem.productName))}" style="width:42px; height:52px; border-radius:8px; object-fit:cover; flex-shrink:0;">
                <div style="flex:1;">
                  <div style="font-size:0.88rem; font-weight:700; color:var(--text-color); margin-bottom:2px;">${escapeHtml(subItem.productName)}</div>
                  <div style="font-size:0.72rem; color:var(--text-soft);">
                    ${subItem.size ? `مقاس: ${escapeHtml(subItem.size)}` : ''}
                    ${subItem.color ? ` • لون: ${escapeHtml(subItem.color)}` : ''}
                  </div>
                </div>
                <div style="font-size:0.85rem; font-weight:700; color:var(--text-color);">${formatPrice(subItem.price)} ج.م</div>
              </div>
            `).join('')}
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center; padding-top:10px;">
            <div style="font-size:0.85rem; color:var(--text-soft); text-decoration:line-through;">${formatPrice(item.originalPrice)} ج.م</div>
            <div style="font-weight:800; color:var(--success); font-size:1.1rem;">${formatPrice(item.finalPrice)} ج.م</div>
          </div>
        </div>
      `;
    }
    
    return `
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
    `;
  }).join('');
  
  const total = calcCartTotal();
  if (totalEl) totalEl.textContent = `الإجمالي: ${formatPrice(total)} ج.م`;
  
  container.querySelectorAll('[data-plus]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.plus, 1)));
  container.querySelectorAll('[data-minus]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.minus, -1)));
  container.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.remove)));
}

// =====================================================
// إرسال الطلب (وتحديث المخزون)
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
  
  // تجهيز ملخص الطلب
  const summaryParts = [];
  cart.forEach(c => {
    if (c.type === 'bundle') {
      const bundleItemsDesc = c.items.map(i => `${i.productName} (${i.size}${i.color ? '-'+i.color : ''}) ×${i.qty}`).join(' + ');
      summaryParts.push(`[عرض] ${c.bundleTitle}: ${bundleItemsDesc}`);
    } else {
      summaryParts.push(`${c.name} ×${c.quantity}${c.size ? ' ('+c.size+')' : ''}${c.color ? ' - '+c.color : ''}`);
    }
  });
  const summary = summaryParts.join(' · ');
  const fullAddress = `${city} - ${address}`;
  
  const orderItems = [];
  cart.forEach(c => {
    if (c.type === 'bundle') {
      c.items.forEach(item => {
        orderItems.push({
          type: 'bundle',
          bundleId: c.bundleId,
          bundleTitle: c.bundleTitle,
          productId: item.productId,
          name: item.productName,
          size: item.size,
          color: item.color,
          quantity: item.qty,
          originalPrice: item.price,
          finalBundlePrice: c.finalPrice
        });
      });
    } else {
      orderItems.push({
        type: 'single',
        id: c.id,
        name: c.name,
        price: c.price,
        quantity: c.quantity,
        size: c.size,
        color: c.color
      });
    }
  });
  
  const orderData = {
    clientId: getClientId(),
    customerName: name,
    customerPhone: phoneCheck.full,
    customerPhoneLocal: phone,
    customerNetwork: phoneCheck.network,
    area: city,
    addressDetails: address,
    fullAddress,
    paymentMethod: payment,
    notes,
    items: orderItems,
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
  
  // **خصم الكميات من المخزون**
  cart.forEach(c => {
    if (c.type === 'bundle') {
      c.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        if (prod && prod.sizeMatrix && prod.sizeMatrix[item.size]) {
          prod.sizeMatrix[item.size].qty = Math.max(0, prod.sizeMatrix[item.size].qty - item.qty);
        }
      });
    } else {
      const prod = products.find(p => p.id === c.id);
      if (prod && c.size && prod.sizeMatrix && prod.sizeMatrix[c.size]) {
        prod.sizeMatrix[c.size].qty = Math.max(0, prod.sizeMatrix[c.size].qty - c.quantity);
      }
    }
  });
  await saveStoreData(); // حفظ المخزون الجديد
  
  // رسالة واتساب
  let msg = `طلب جديد من ${storeConfig.name}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n`;
  cart.forEach(c => {
    if (c.type === 'bundle') {
      msg += `[عرض] ${c.bundleTitle}\n`;
      c.items.forEach(item => {
        msg += `   • ${item.productName} (${item.size}) ×${item.qty}\n`;
      });
      msg += `   الإجمالي: ${c.finalPrice} ج.م (بعد خصم ${c.discountPercent}%)\n`;
    } else {
      msg += `• ${c.name}`;
      if (c.size) msg += ` (${c.size})`;
      if (c.color) msg += ` - ${c.color}`;
      msg += ` ×${c.quantity} = ${c.price * c.quantity} ج.م\n`;
    }
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
  
  const list = await loadOrdersFromFirebase('all', true);
  
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
  if (window.confirm(msg)) {
    if (onYes) onYes();
  }
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
  if (pageId === 'tryon') initTryOn();
  
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
  restoreScroll();
  isAdminLoggedIn = false;
}

function showAdminDashboard() {
  document.querySelectorAll('.admin-panel-overlay').forEach(el => el.remove());
  document.body.classList.add('admin-open');
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  
  const overlay = document.createElement('div');
  overlay.className = 'admin-panel-overlay show';
  overlay.innerHTML = `
    <div class="admin-dashboard">
      <div class="admin-top">
        <h2><i class="fas fa-store" style="color:var(--accent);margin-left:10px;"></i> لوحة تحكم ${escapeHtml(storeConfig.name)}</h2>
        <button id="closeAdminDash" class="admin-close-btn"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</button>
      </div>
      
      <div class="admin-tabs">
        <button class="admin-tab-btn active" data-tab="store"><i class="fas fa-cog"></i> إعدادات المتجر</button>
        <button class="admin-tab-btn" data-tab="products"><i class="fas fa-tshirt"></i> المنتجات</button>
        <button class="admin-tab-btn" data-tab="offers"><i class="fas fa-gift"></i> العروض</button>
        <button class="admin-tab-btn" data-tab="orders"><i class="fas fa-shopping-bag"></i> الطلبات</button>
        <button class="admin-tab-btn" data-tab="reviews"><i class="fas fa-comments"></i> التقييمات</button>
      </div>
      
      <!-- تبويب المعلومات -->
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
      
      <!-- تبويب المنتجات -->
      <div id="tab-products" class="admin-tab-content">
        <div class="admin-section">
          <h3><i class="fas fa-plus-circle"></i> إضافة منتج جديد</h3>
          <div class="admin-grid-2">
            <div>
              <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">اسم المنتج</label>
              <input type="text" id="newName" class="admin-input" placeholder="مثال: تيشيرت قطن">
            </div>
            <div>
              <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">الفئة</label>
              <select id="newCategory" class="admin-input">
                <option value="tshirts">تيشيرتات</option>
                <option value="pants">بناطيل</option>
                <option value="shoes">أحذية</option>
              </select>
            </div>
          </div>
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">الوصف</label>
          <textarea id="newDesc" class="admin-input" rows="3" placeholder="وصف المنتج..."></textarea>

          <div style="margin-top: 15px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="newIsNew" style="width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer;" checked>
            <label for="newIsNew" style="font-weight: 700; font-size: 0.95rem; cursor: pointer;">هل هذا المنتج "وصل حديثاً"؟</label>
          </div>
          
          <div style="margin-top:20px; margin-bottom:20px; padding:15px; background:var(--bg-body); border-radius:12px; border:1px solid var(--border-color);">
            <label style="font-weight:700;font-size:0.9rem; margin-bottom:10px; display:block;">
              <i class="fas fa-link"></i> روابط صور المنتج (يمكنك إضافة أكثر من صورة):
            </label>
            
            <div style="display:flex; gap:10px; margin-bottom:10px;">
              <input type="text" id="newImgUrlInput" class="admin-input" placeholder="ضع رابط صورة هنا..." style="margin-bottom:0;">
              <button type="button" id="addImgUrlBtn" class="admin-btn" style="padding:0 15px; white-space:nowrap;">إضافة</button>
            </div>
            
            <div id="galleryPreview" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;"></div>
          </div>

          <div id="newSizesContainer" style="margin-top:20px; padding:15px; background:var(--bg-body); border-radius:12px; border:1px solid var(--border-color);"></div>
          
          <button id="addProductBtn" class="admin-btn" style="width:100%;justify-content:center; margin-top:20px; padding:15px;">
            <i class="fas fa-plus"></i> إضافة المنتج
          </button>
        </div>
        
        <div class="admin-section">
          <h3><i class="fas fa-list"></i> المنتجات الحالية</h3>
          <div id="productsListAdmin"></div>
        </div>
      </div>
      
      <!-- تبويب العروض -->
      <div id="tab-offers" class="admin-tab-content">
        <div class="admin-section">
          <h3><i class="fas fa-gift"></i> إنشاء عرض (باقة كمية)</h3>
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">اسم العرض</label>
          <input type="text" id="bundleTitle" class="admin-input" placeholder="مثال: عرض الصيف">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">الوصف</label>
          <textarea id="bundleDesc" class="admin-input" rows="2" placeholder="مثال: اختر أي 2 تيشيرت واحصل على خصم 20%"></textarea>
          
          <div class="admin-grid-2">
            <div>
              <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">نسبة الخصم (%)</label>
              <input type="number" id="bundleDiscount" class="admin-input" placeholder="20" min="1" max="99">
            </div>
            <div>
              <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">عدد القطع المطلوبة</label>
              <input type="number" id="bundleRequiredCount" class="admin-input" placeholder="2" min="1">
            </div>
          </div>
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block; margin-top:10px;">المنتجات المسموحة في العرض</label>
          <div style="background:var(--bg-soft); padding:12px; border-radius:10px; margin-bottom:15px;">
            <select id="bundleProductSelector" class="admin-input" style="margin-bottom:10px;">
              <option value="">-- اختر منتج --</option>
            </select>
            
            <div id="bundleSizesSelector" style="margin-bottom:10px;"></div>
            
            <button id="bundleAddProductBtn" class="admin-btn" style="width:100%; justify-content:center;">
              <i class="fas fa-plus"></i> إضافة المنتج للعرض
            </button>
          </div>
          
          <div id="bundleProductsList" style="margin-bottom:15px;"></div>
          
          <button id="createBundleBtn" class="admin-btn" style="width:100%; justify-content:center; padding:14px; background:var(--accent); color:#1a1a1a;">
            <i class="fas fa-save"></i> حفظ العرض
          </button>
        </div>
        
        <div class="admin-section">
          <h3><i class="fas fa-list"></i> العروض الحالية</h3>
          <div id="bundlesListAdmin"></div>
        </div>
      </div>
      
      <!-- تبويب الطلبات -->
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

      <!-- تبويب التقييمات -->
      <div id="tab-reviews" class="admin-tab-content">
        <div class="admin-section">
          <h3><i class="fas fa-comments"></i> تقييمات العملاء</h3>
          <div id="reviewsListAdmin"></div>
        </div>
      </div>
      
    </div>
  `;
  document.body.appendChild(overlay);
  
  overlay.querySelector('#closeAdminDash').onclick = async () => {
    try { await signOut(auth); } catch(e) {}
    closeAdminDashboard();
    showToast('تم تسجيل الخروج');
  };
  
  overlay.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      overlay.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active-tab'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById(`tab-${tab}`).classList.add('active-tab');
      
      if (tab === 'products') renderProductsAdmin();
      if (tab === 'offers') { populateBundleProductSelector(); renderBundlesAdmin(); }
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
    const saved = await saveStoreData();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ الإعدادات';
    
    if (saved) {
      applyStoreConfig();
      showToast('✅ تم حفظ الإعدادات');
    }
  };
  
  // =====================================================
  // إدارة معرض الصور (روابط فقط)
  // =====================================================
  let galleryImages = []; 
  
  function renderGalleryPreview() {
    const prev = overlay.querySelector('#galleryPreview');
    if (!prev) return;
    prev.innerHTML = galleryImages.map((src, i) => `
      <div style="position:relative; width:60px; height:75px; border-radius:8px; overflow:hidden; border:1px solid var(--border-color);">
        <img src="${escapeHtml(src)}" style="width:100%; height:100%; object-fit:cover;">
        <button type="button" onclick="window.__removeGalleryImg(${i})" style="position:absolute; top:2px; left:2px; background:rgba(231,76,60,0.9); color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:0.7rem; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fas fa-times"></i></button>
      </div>
    `).join('');
  }

  window.__removeGalleryImg = (idx) => {
    galleryImages.splice(idx, 1);
    renderGalleryPreview();
  };

  overlay.querySelector('#addImgUrlBtn').onclick = () => {
    const input = overlay.querySelector('#newImgUrlInput');
    const url = input.value.trim();
    if (url) {
      galleryImages.push(url);
      input.value = '';
      renderGalleryPreview();
    }
  };

  // =====================================================
  // إدارة المقاسات والأسعار والألوان (إضافة)
  // =====================================================
  const categorySelect = overlay.querySelector('#newCategory');
  const sizesContainer = overlay.querySelector('#newSizesContainer');

  function updateAdminSizes() {
    const cat = categorySelect.value;
    let sizesList = [];
    if (cat === 'tshirts') sizesList = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
    else if (cat === 'pants') sizesList = ['28', '30', '32', '34', '36', '38', '40', '42'];
    else if (cat === 'shoes') sizesList = ['38', '39', '40', '41', '42', '43', '44', '45'];

    let html = `<label style="font-weight:700;font-size:1rem;margin-bottom:10px;display:block;color:var(--accent);"><i class="fas fa-tags"></i> إدارة المقاسات والألوان والأسعار:</label>`;
    
    sizesList.forEach(size => {
      html += `
        <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:10px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:8px; margin-bottom:8px;">
            <strong style="font-size:1rem;">مقاس: ${size}</strong>
            <div style="display:flex; gap:10px; align-items:center;">
               <label style="font-size:0.85rem; font-weight:700;">السعر:</label>
               <input type="number" id="size_price_${size}" value="0" placeholder="سعر المقاس" style="width:80px; padding:4px; border-radius:4px; border:1px solid var(--border-color); font-size:0.85rem;">
            </div>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:5px;">
              <input type="checkbox" id="size_chk_${size}" value="${size}" checked style="width:16px;height:16px;accent-color:var(--accent);">
              <span style="font-size:0.85rem;">متوفر</span>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
              <label style="font-size:0.85rem;">الكمية:</label>
              <input type="number" id="size_qty_${size}" value="10" min="0" style="width:50px; padding:4px; border-radius:4px; border:1px solid var(--border-color);">
            </div>
            
            <div style="width:100%; margin-top:8px; display:flex; gap:12px; flex-wrap:wrap;">
              ${AVAILABLE_COLORS.map(c => `
                <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                  <input type="checkbox" id="size_${size}_color_${c.id}" value="${c.name}" ${c.id === 'black' ? 'checked' : ''}> 
                  <span style="font-size:0.8rem; display:inline-block; width:12px; height:12px; border-radius:50%; background:${c.hex}; border:1px solid var(--border-color);"></span>
                  <span style="font-size:0.8rem;">${c.name}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    });
    sizesContainer.innerHTML = html;
  }

  categorySelect.addEventListener('change', updateAdminSizes);
  updateAdminSizes();
  
  overlay.querySelector('#addProductBtn').onclick = async () => {
    const name = overlay.querySelector('#newName').value.trim();
    const category = overlay.querySelector('#newCategory').value;
    const desc = overlay.querySelector('#newDesc').value.trim();
    const isNewProduct = overlay.querySelector('#newIsNew').checked;
    
    if (!name) { showToast('أدخل اسم المنتج'); return; }
    if (galleryImages.length === 0) { showToast('أضف رابط صورة واحد على الأقل'); return; }
    
    const sizeMatrix = {}; 
    const allAvailableColors = new Set();
    let mainPrice = Infinity;
    let isAnySizeAvail = false;

    let sizesListToCheck = [];
    if (category === 'tshirts') sizesListToCheck = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
    else if (category === 'pants') sizesListToCheck = ['28', '30', '32', '34', '36', '38', '40', '42'];
    else if (category === 'shoes') sizesListToCheck = ['38', '39', '40', '41', '42', '43', '44', '45'];

    sizesListToCheck.forEach(size => {
      const chk = overlay.querySelector(`#size_chk_${size}`);
      if (chk && chk.checked) {
        const qty = parseInt(overlay.querySelector(`#size_qty_${size}`).value) || 0;
        const price = parseFloat(overlay.querySelector(`#size_price_${size}`).value) || 0;
        
        if (price < mainPrice && price > 0) mainPrice = price;
        if (mainPrice === Infinity) mainPrice = price;
        
        const colorsForSize = [];
        AVAILABLE_COLORS.forEach(c => {
          const cchk = overlay.querySelector(`#size_${size}_color_${c.id}`);
          if (cchk && cchk.checked) {
             colorsForSize.push(c.name);
             allAvailableColors.add(c.name);
          }
        });
        
        sizeMatrix[size] = { qty, price, colors: colorsForSize };
        if (qty > 0) isAnySizeAvail = true;
      }
    });

    if (Object.keys(sizeMatrix).length === 0) { showToast('اختر مقاس واحد على الأقل'); return; }
    if (mainPrice === Infinity) mainPrice = 0;

    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    
    const colorsArray = Array.from(allAvailableColors).map(c => ({ name: c, hex: colorHexMap[c] || '#cccccc' }));

    products.push({
      id: newId, 
      name, 
      category, 
      price: mainPrice, 
      offerPrice: null,
      image: galleryImages[0], 
      gallery: galleryImages, 
      description: desc,
      sizes: Object.keys(sizeMatrix),
      sizeMatrix: sizeMatrix, 
      colors: colorsArray.length > 0 ? colorsArray : [{name:'أسود',hex:'#1a1a1a'}],
      isFeatured: false, 
      isNew: isNewProduct,
      ratings: [], 
      avgRating: 0, 
      totalRatings: 0, 
      isAvailable: isAnySizeAvail
    });
    
    const btn = overlay.querySelector('#addProductBtn');
    btn.disabled = true;
    btn.innerHTML = 'جاري الحفظ...';
    const saved = await saveStoreData();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-plus"></i> إضافة المنتج';
    
    if (!saved) {
      showToast('❌ فشل حفظ المنتج');
      return;
    }
    
    galleryImages = [];
    renderGalleryPreview();
    overlay.querySelector('#newName').value = '';
    overlay.querySelector('#newDesc').value = '';
    
    renderProductsAdmin();
    renderProducts();
    renderFeatured();
    renderNewArrivals();
    showToast('✅ تم إضافة المنتج بنجاح');
  };

  // =====================================================
  // إدارة الباقات (Bundles) في الأدمن
  // =====================================================
  function populateBundleProductSelector() {
    const sel = overlay.querySelector('#bundleProductSelector');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- اختر منتج --</option>' + 
      products.filter(p => p.isAvailable !== false).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    
    sel.onchange = () => {
      const pid = parseInt(sel.value);
      const sizesSel = overlay.querySelector('#bundleSizesSelector');
      if (!pid) {
        sizesSel.innerHTML = '';
        return;
      }
      
      const prod = products.find(p => p.id === pid);
      if (!prod || !prod.sizeMatrix) {
        sizesSel.innerHTML = '<p style="font-size:0.85rem; color:var(--text-soft);">هذا المنتج ليس له مقاسات محددة.</p>';
        return;
      }
      
      sizesSel.innerHTML = `
        <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:6px;">اختر المقاسات المتاحة في العرض:</label>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${Object.keys(prod.sizeMatrix).map(size => {
            const matrix = prod.sizeMatrix[size];
            if (matrix.qty <= 0) return '';
            return `
              <label style="display:flex; align-items:center; gap:4px; background:var(--card-bg); padding:6px 10px; border-radius:8px; border:1px solid var(--border-color); cursor:pointer;">
                <input type="checkbox" class="bundle-size-check" value="${size}" checked>
                <span style="font-size:0.85rem;">${size} (${matrix.qty} متاح)</span>
              </label>
            `;
          }).join('')}
        </div>
      `;
    };
  }
  
  let pendingBundleProducts = [];
  
  overlay.querySelector('#bundleAddProductBtn').onclick = () => {
    const sel = overlay.querySelector('#bundleProductSelector');
    const pid = parseInt(sel.value);
    if (!pid) { showToast('اختر منتجاً أولاً'); return; }
    
    const prod = products.find(p => p.id === pid);
    if (!prod) return;
    
    const selectedSizes = [];
    overlay.querySelectorAll('.bundle-size-check:checked').forEach(chk => {
      selectedSizes.push(chk.value);
    });
    
    if (selectedSizes.length === 0) { showToast('اختر مقاساً واحداً على الأقل'); return; }
    
    const existingIdx = pendingBundleProducts.findIndex(p => p.productId === pid);
    if (existingIdx !== -1) {
      pendingBundleProducts[existingIdx].sizes = selectedSizes;
    } else {
      pendingBundleProducts.push({ productId: pid, sizes: selectedSizes });
    }
    
    sel.value = '';
    overlay.querySelector('#bundleSizesSelector').innerHTML = '';
    renderPendingBundleProducts();
  };
  
  function renderPendingBundleProducts() {
    const list = overlay.querySelector('#bundleProductsList');
    if (!list) return;
    if (pendingBundleProducts.length === 0) {
      list.innerHTML = '<p style="text-align:center; color:var(--text-soft); font-size:0.85rem;">لم تتم إضافة منتجات بعد</p>';
      return;
    }
    
    list.innerHTML = pendingBundleProducts.map((item, idx) => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return '';
      return `
        <div style="display:flex; align-items:center; gap:10px; background:var(--card-bg); padding:10px; border-radius:10px; border:1px solid var(--border-color); margin-bottom:8px;">
          <img src="${escapeHtml(buildImageUrl(prod.image, prod.name))}" style="width:40px; height:50px; border-radius:6px; object-fit:cover;">
          <div style="flex:1;">
            <strong style="font-size:0.9rem;">${escapeHtml(prod.name)}</strong>
            <div style="font-size:0.8rem; color:var(--text-soft);">المقاسات: ${item.sizes.join(', ')}</div>
          </div>
          <button onclick="window.__removePendingBundleItem(${idx})" style="color:var(--danger); font-size:0.9rem;"><i class="fas fa-trash"></i></button>
        </div>
      `;
    }).join('');
  }
  
  window.__removePendingBundleItem = (idx) => {
    pendingBundleProducts.splice(idx, 1);
    renderPendingBundleProducts();
  };
  
  overlay.querySelector('#createBundleBtn').onclick = async () => {
    const title = overlay.querySelector('#bundleTitle').value.trim();
    const desc = overlay.querySelector('#bundleDesc').value.trim();
    const discount = parseInt(overlay.querySelector('#bundleDiscount').value);
    const requiredCount = parseInt(overlay.querySelector('#bundleRequiredCount').value);
    
    if (!title || !desc || !discount || !requiredCount) { showToast('اكمل جميع البيانات'); return; }
    if (pendingBundleProducts.length === 0) { showToast('أضف منتجاً واحداً على الأقل للعرض'); return; }
    
    const newBundle = {
      id: 'bundle_' + Date.now(),
      title,
      desc,
      discountPercent: discount,
      requiredCount,
      productSelections: pendingBundleProducts,
      isAvailable: true
    };
    
    bundles.push(newBundle);
    
    const btn = overlay.querySelector('#createBundleBtn');
    btn.disabled = true;
    btn.innerHTML = 'جاري الحفظ...';
    const saved = await saveStoreData();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ العرض';
    
    if (saved) {
      overlay.querySelector('#bundleTitle').value = '';
      overlay.querySelector('#bundleDesc').value = '';
      overlay.querySelector('#bundleDiscount').value = '';
      overlay.querySelector('#bundleRequiredCount').value = '';
      pendingBundleProducts = [];
      renderPendingBundleProducts();
      renderBundlesAdmin();
      renderOffers();
      showToast('✅ تم حفظ العرض بنجاح');
    }
  };
  
  function renderBundlesAdmin() {
    const cont = overlay.querySelector('#bundlesListAdmin');
    if (!cont) return;
    if (bundles.length === 0) {
      cont.innerHTML = '<p style="text-align:center; color:var(--text-soft); padding:20px;">لا توجد عروض حالياً</p>';
      return;
    }
    
    cont.innerHTML = bundles.map(b => `
      <div class="admin-product-row" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
          <div>
            <strong style="font-size:1rem; color:var(--accent);">${escapeHtml(b.title)}</strong>
            <p style="font-size:0.8rem; color:var(--text-soft); margin-top:4px;">${escapeHtml(b.desc)}</p>
            <div style="font-size:0.75rem; margin-top:6px;">
              <span style="background:var(--accent-soft); padding:3px 8px; border-radius:6px; margin-left:6px;">خصم ${b.discountPercent}%</span>
              <span style="background:var(--bg-soft); padding:3px 8px; border-radius:6px;">${b.requiredCount} قطع</span>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button onclick="window.__editBundle('${b.id}')" style="background:var(--accent-soft); padding:6px 10px; border-radius:8px; font-size:0.8rem;"><i class="fas fa-edit"></i></button>
            <button onclick="window.__deleteBundle('${b.id}')" style="background:#ffe0e0; color:var(--danger); padding:6px 10px; border-radius:8px; font-size:0.8rem;"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; padding-top:8px; border-top:1px dashed var(--border-color);">
          ${b.productSelections.map(sel => {
            const prod = products.find(p => p.id === sel.productId);
            if (!prod) return '';
            return `<span style="font-size:0.75rem; background:var(--bg-soft); padding:3px 8px; border-radius:6px;">${escapeHtml(prod.name)} (${sel.sizes.join(', ')})</span>`;
          }).join('')}
        </div>
      </div>
    `).join('');
  }
  
  window.__deleteBundle = (id) => {
    if (window.confirm('حذف هذا العرض نهائياً؟')) {
      bundles = bundles.filter(b => b.id !== id);
      saveStoreData().then(saved => {
        if (saved) {
          renderBundlesAdmin();
          renderOffers();
          showToast('✅ تم حذف العرض');
        }
      });
    }
  };
  
  window.__editBundle = (id) => {
    const bundle = bundles.find(b => b.id === id);
    if (!bundle) return;
    
    overlay.querySelector('#bundleTitle').value = bundle.title;
    overlay.querySelector('#bundleDesc').value = bundle.desc;
    overlay.querySelector('#bundleDiscount').value = bundle.discountPercent;
    overlay.querySelector('#bundleRequiredCount').value = bundle.requiredCount;
    
    pendingBundleProducts = [...bundle.productSelections];
    renderPendingBundleProducts();
    
    const btn = overlay.querySelector('#createBundleBtn');
    const oldOnclick = btn.onclick;
    
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
    btn.onclick = async () => {
      const newTitle = overlay.querySelector('#bundleTitle').value.trim();
      const newDesc = overlay.querySelector('#bundleDesc').value.trim();
      const newDiscount = parseInt(overlay.querySelector('#bundleDiscount').value);
      const newCount = parseInt(overlay.querySelector('#bundleRequiredCount').value);
      
      if (!newTitle || !newDesc || !newDiscount || !newCount) { showToast('اكمل البيانات'); return; }
      if (pendingBundleProducts.length === 0) { showToast('أضف منتجاً'); return; }
      
      bundle.title = newTitle;
      bundle.desc = newDesc;
      bundle.discountPercent = newDiscount;
      bundle.requiredCount = newCount;
      bundle.productSelections = pendingBundleProducts;
      
      const saved = await saveStoreData();
      if (saved) {
        showToast('✅ تم تعديل العرض');
        overlay.querySelector('#bundleTitle').value = '';
        overlay.querySelector('#bundleDesc').value = '';
        overlay.querySelector('#bundleDiscount').value = '';
        overlay.querySelector('#bundleRequiredCount').value = '';
        pendingBundleProducts = [];
        renderPendingBundleProducts();
        renderBundlesAdmin();
        renderOffers();
        btn.innerHTML = '<i class="fas fa-save"></i> حفظ العرض';
        btn.onclick = oldOnclick;
      }
    };
  };
  
  function renderProductsAdmin() {
    const cont = overlay.querySelector('#productsListAdmin');
    if (!cont) return;

    if (products.length === 0) { 
      cont.innerHTML = '<p style="text-align:center;padding:20px;">لا توجد منتجات</p>'; 
      return; 
    }
    
    cont.innerHTML = products.map(p => `
      <div class="admin-product-row">
        <img src="${escapeHtml(buildImageUrl(p.image, p.name))}" class="admin-product-img">
        <div class="admin-product-info">
          <strong>${escapeHtml(p.name)}</strong>
          <span>${formatPrice(p.price)} ج.م — ${categoryLabels[p.category]}</span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
          <button class="admin-edit-btn" data-edit="${p.id}" style="background:var(--accent-soft); color:var(--text-color); border:1px solid var(--border-color); padding:8px 16px; border-radius:50px; font-weight:700; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; gap:6px;"><i class="fas fa-edit"></i> تعديل</button>
          <button class="admin-del-btn" data-del="${p.id}"><i class="fas fa-trash"></i> حذف</button>
        </div>
      </div>
    `).join('');
    
    cont.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = parseInt(btn.dataset.del);
        showConfirm('حذف المنتج نهائياً؟', async () => {
          products = products.filter(p => p.id !== id);
          const saved = await saveStoreData();
          if (saved) {
            renderProductsAdmin();
            renderProducts();
            renderFeatured();
            renderNewArrivals();
            showToast('✅ تم الحذف');
          }
        });
      };
    });

    cont.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = parseInt(btn.dataset.edit);
        openEditProductModal(id);
      };
    });
  }

  function openEditProductModal(productId) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.zIndex = '100000';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:700px; max-height:90vh; overflow-y:auto;">
        <div class="modal-header" style="position:sticky; top:0; background:var(--card-bg); z-index:2;">
          <h3><i class="fas fa-edit"></i> تعديل المنتج: ${escapeHtml(p.name)}</h3>
          <span class="modal-close" id="closeEditModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">اسم المنتج</label>
            <input type="text" id="editProdName" class="admin-input" value="${escapeHtml(p.name)}">
          </div>
          <div class="form-group">
            <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">الفئة</label>
            <select id="editProdCategory" class="admin-input">
              <option value="tshirts" ${p.category === 'tshirts' ? 'selected' : ''}>تيشيرتات</option>
              <option value="pants" ${p.category === 'pants' ? 'selected' : ''}>بناطيل</option>
              <option value="shoes" ${p.category === 'shoes' ? 'selected' : ''}>أحذية</option>
            </select>
          </div>
          <div class="form-group">
            <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">الوصف</label>
            <textarea id="editProdDesc" class="admin-input" rows="3">${escapeHtml(p.description || '')}</textarea>
          </div>

          <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="editIsNew" ${p.isNew ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer;">
            <label for="editIsNew" style="font-weight: 700; font-size: 0.95rem; cursor: pointer;">هل هذا المنتج "وصل حديثاً"؟</label>
          </div>

          <hr style="margin:15px 0; border:none; border-top:1px dashed var(--border-color);">

          <div style="margin-top:15px; margin-bottom:15px;">
            <label style="font-weight:700;font-size:0.9rem; margin-bottom:10px; display:block;">روابط صور المنتج:</label>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
              <input type="text" id="editImgUrlInput" class="admin-input" placeholder="أو ضع رابط صورة..." style="margin-bottom:0;">
              <button type="button" id="editAddImgUrlBtn" class="admin-btn" style="padding:0 15px;">إضافة</button>
            </div>
            <div id="editGalleryPreview" style="display:flex; gap:8px; flex-wrap:wrap;"></div>
          </div>

          <hr style="margin:15px 0; border:none; border-top:1px dashed var(--border-color);">
          
          <div id="editSizesContainer" style="margin-top:15px;"></div>
        </div>
        <div class="modal-footer" style="position:sticky; bottom:0; background:var(--card-bg); z-index:2;">
          <button id="saveEditBtn" class="admin-btn" style="width:100%; justify-content:center; padding:14px;">
            <i class="fas fa-save"></i> حفظ التعديلات
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('#closeEditModal').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    let editGalleryImages = [...(p.gallery || [])];
    if (p.image && !editGalleryImages.includes(p.image)) {
      editGalleryImages.unshift(p.image);
    }

    function renderEditGallery() {
      const prev = modal.querySelector('#editGalleryPreview');
      if (!prev) return;
      prev.innerHTML = editGalleryImages.map((src, i) => `
        <div style="position:relative; width:60px; height:75px; border-radius:8px; overflow:hidden; border:1px solid var(--border-color);">
          <img src="${escapeHtml(src)}" style="width:100%; height:100%; object-fit:cover;">
          <button type="button" onclick="window.__removeEditGalleryImg(${i})" style="position:absolute; top:2px; left:2px; background:rgba(231,76,60,0.9); color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:0.7rem; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fas fa-times"></i></button>
        </div>
      `).join('');
    }
    
    window.__removeEditGalleryImg = (idx) => {
      editGalleryImages.splice(idx, 1);
      renderEditGallery();
    };
    renderEditGallery();

    modal.querySelector('#editAddImgUrlBtn').onclick = () => {
      const input = modal.querySelector('#editImgUrlInput');
      const url = input.value.trim();
      if (url) {
        editGalleryImages.push(url);
        input.value = '';
        renderEditGallery();
      }
    };

    const editCategorySelect = modal.querySelector('#editProdCategory');
    const editSizesContainer = modal.querySelector('#editSizesContainer');

    function renderEditSizes() {
      const cat = editCategorySelect.value;
      let sizesList = [];
      if (cat === 'tshirts') sizesList = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
      else if (cat === 'pants') sizesList = ['28', '30', '32', '34', '36', '38', '40', '42'];
      else if (cat === 'shoes') sizesList = ['38', '39', '40', '41', '42', '43', '44', '45'];

      let html = `<label style="font-weight:700;font-size:1rem;margin-bottom:10px;display:block;color:var(--accent);"><i class="fas fa-tags"></i> المقاسات والأسعار:</label>`;
      
      sizesList.forEach(size => {
        const matrix = (p.sizeMatrix && p.sizeMatrix[size]) ? p.sizeMatrix[size] : { qty: 0, price: p.price || 0, colors: [] };
        const isChecked = !!(p.sizeMatrix && p.sizeMatrix[size]);
        
        html += `
          <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:10px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:8px; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="edit_size_chk_${size}" value="${size}" ${isChecked ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent);">
                <strong style="font-size:1rem;">مقاس: ${size}</strong>
              </div>
              <div style="display:flex; gap:10px; align-items:center;">
                <label style="font-size:0.85rem; font-weight:700;">السعر:</label>
                <input type="number" id="edit_size_price_${size}" value="${matrix.price}" placeholder="سعر المقاس" style="width:80px; padding:4px; border-radius:4px; border:1px solid var(--border-color); font-size:0.85rem;">
              </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:5px;">
                <label style="font-size:0.85rem;">الكمية:</label>
                <input type="number" id="edit_size_qty_${size}" value="${matrix.qty}" min="0" style="width:50px; padding:4px; border-radius:4px; border:1px solid var(--border-color);">
              </div>
              
              <div style="width:100%; margin-top:8px; display:flex; gap:12px; flex-wrap:wrap;">
                ${AVAILABLE_COLORS.map(c => {
                  const isColorChecked = matrix.colors && matrix.colors.includes(c.name);
                  return `
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                      <input type="checkbox" id="edit_size_${size}_color_${c.id}" value="${c.name}" ${isColorChecked ? 'checked' : ''}> 
                      <span style="font-size:0.8rem; display:inline-block; width:12px; height:12px; border-radius:50%; background:${c.hex}; border:1px solid var(--border-color);"></span>
                      <span style="font-size:0.8rem;">${c.name}</span>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        `;
      });
      editSizesContainer.innerHTML = html;
    }
    
    editCategorySelect.addEventListener('change', renderEditSizes);
    renderEditSizes();

    modal.querySelector('#saveEditBtn').onclick = async () => {
      const newName = modal.querySelector('#editProdName').value.trim();
      const newCat = editCategorySelect.value;
      const newDesc = modal.querySelector('#editProdDesc').value.trim();
      const newIsNew = modal.querySelector('#editIsNew').checked;
      
      if (!newName) { showToast('أدخل اسم المنتج'); return; }
      if (editGalleryImages.length === 0) { showToast('أضف رابط صورة واحد على الأقل'); return; }

      const newSizeMatrix = {};
      const allColors = new Set();
      let newMainPrice = Infinity;
      let anyAvail = false;

      let sizesListToCheck = [];
      if (newCat === 'tshirts') sizesListToCheck = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
      else if (newCat === 'pants') sizesListToCheck = ['28', '30', '32', '34', '36', '38', '40', '42'];
      else if (newCat === 'shoes') sizesListToCheck = ['38', '39', '40', '41', '42', '43', '44', '45'];

      sizesListToCheck.forEach(size => {
        const chk = modal.querySelector(`#edit_size_chk_${size}`);
        if (chk && chk.checked) {
          const qty = parseInt(modal.querySelector(`#edit_size_qty_${size}`).value) || 0;
          const price = parseFloat(modal.querySelector(`#edit_size_price_${size}`).value) || 0;
          
          if (price < newMainPrice && price > 0) newMainPrice = price;
          if (newMainPrice === Infinity) newMainPrice = price;

          const colorsForSize = [];
          AVAILABLE_COLORS.forEach(c => {
            const cchk = modal.querySelector(`#edit_size_${size}_color_${c.id}`);
            if (cchk && cchk.checked) {
              colorsForSize.push(c.name);
              allColors.add(c.name);
            }
          });

          newSizeMatrix[size] = { qty, price, colors: colorsForSize };
          if (qty > 0) anyAvail = true;
        }
      });

      if (Object.keys(newSizeMatrix).length === 0) { showToast('اختر مقاس واحد على الأقل'); return; }
      if (newMainPrice === Infinity) newMainPrice = 0;

      const colorsArray = Array.from(allColors).map(c => ({ name: c, hex: colorHexMap[c] || '#cccccc' }));

      const idx = products.findIndex(x => x.id === productId);
      if (idx !== -1) {
        products[idx] = {
          ...products[idx],
          name: newName,
          category: newCat,
          description: newDesc,
          price: newMainPrice,
          image: editGalleryImages[0],
          gallery: editGalleryImages,
          sizes: Object.keys(newSizeMatrix),
          sizeMatrix: newSizeMatrix,
          colors: colorsArray.length > 0 ? colorsArray : [{ name: 'أسود', hex: '#1a1a1a' }],
          isNew: newIsNew,
          isAvailable: anyAvail
        };
      }

      const saveBtn = modal.querySelector('#saveEditBtn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = 'جاري الحفظ...';
      const saved = await saveStoreData();
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';

      if (saved) {
        modal.remove();
        renderProductsAdmin();
        renderProducts();
        renderFeatured();
        renderNewArrivals();
        showToast('✅ تم حفظ التعديلات بنجاح');
      } else {
        showToast('❌ فشل الحفظ — تحقق من الصلاحيات');
      }
    };
  }
  
  async function renderOrdersAdmin() {
    const cont = overlay.querySelector('#ordersListAdmin');
    cont.innerHTML = '<p style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</p>';
    
    const list = await loadOrdersFromFirebase(currentOrdersFilter, false);
    
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
          const saved = await saveStoreData();
          if (saved) {
            renderReviewsAdmin();
            showToast('✅ تم إضافة الرد');
          } else {
            btn.disabled = false;
            btn.textContent = 'رد';
          }
        }
      };
    });
  }
  
  renderProductsAdmin();
  populateBundleProductSelector();
  renderBundlesAdmin();
}

// =====================================================
// Init
// =====================================================
async function init() {
  document.body.style.overflow = 'auto';
  
  loadLocalState();
  getClientId();
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
  
  const drawer = document.getElementById('mobileDrawer');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const menuToggle = document.getElementById('menuToggle');

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDrawer();
    });
  }

  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);

  document.querySelectorAll('.drawer-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pageId = btn.dataset.drawerPage;
      if (!pageId) return;
      
      document.querySelectorAll('.drawer-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      closeDrawer();
      
      setTimeout(() => {
        showPage(pageId);
        window.history.pushState({ page: pageId }, '', window.location.href);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 150);
    });
  });

  document.querySelectorAll('.nav-links .nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = btn.dataset.page;
      if (!pageId) return;
      showPage(pageId);
      window.history.pushState({ page: pageId }, '', window.location.href);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  window.addEventListener('popstate', (e) => {
    if (drawer && drawer.classList.contains('open')) {
      closeDrawer();
      return;
    }
    
    const page = e.state?.page || 'home';
    showPage(page);
    
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.page === page);
    });
    document.querySelectorAll('.drawer-nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.drawerPage === page);
    });
  });

  window.history.replaceState({ page: 'home' }, '', window.location.href);
  
  document.getElementById('logoLink')?.addEventListener('click', () => {
    showPage('home');
    window.history.pushState({ page: 'home' }, '', window.location.href);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('heroShopBtn')?.addEventListener('click', () => {
    document.querySelector('.section')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('heroNewBtn')?.addEventListener('click', () => {
    showPage('new');
    window.history.pushState({ page: 'new' }, '', window.location.href);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  document.querySelectorAll('.section-link[data-page]').forEach(l => {
    l.addEventListener('click', (e) => { 
      e.preventDefault(); 
      const pid = l.dataset.page;
      showPage(pid);
      window.history.pushState({ page: pid }, '', window.location.href);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  document.querySelectorAll('.breadcrumbs a[data-page]').forEach(l => {
    l.addEventListener('click', (e) => { 
      e.preventDefault(); 
      const pid = l.dataset.page;
      showPage(pid);
      window.history.pushState({ page: pid }, '', window.location.href);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
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

// =====================================================
// Try On (3D Mannequin) — كود المانيكان
// =====================================================
function initTryOn() {
  const container = document.getElementById('mannequinCanvas');
  if (!container) return;
  
  // لو المانيكان اتعمل قبل كده، منعملش تاني
  if (typeof THREE !== 'undefined' && threeRenderer) return;

  // 1. تجهيز المشهد
  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x1a1a1a);

  // 2. الكاميرا
  threeCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  threeCamera.position.set(0, 1.2, 3);

  // 3. الريندرر
  threeRenderer = new THREE.WebGLRenderer({ antialias: true });
  threeRenderer.setSize(container.clientWidth, container.clientHeight);
  threeRenderer.shadowMap.enabled = true;
  container.appendChild(threeRenderer.domElement);

  // 4. الإضاءة
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  threeScene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(2, 4, 2);
  dirLight.castShadow = true;
  threeScene.add(dirLight);

  const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
  backLight.position.set(-2, 2, -2);
  threeScene.add(backLight);

  // 5. التحكم في الدوران
  threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
  threeControls.enableDamping = true;
  threeControls.dampingFactor = 0.05;
  threeControls.minDistance = 1.5;
  threeControls.maxDistance = 5;
  threeControls.target.set(0, 1, 0);

  // 6. تحميل المانيكان
  const loader = new GLTFLoader();
  loader.load('assets/abstract-white-man-abstract_man_standing-v2.glb', (gltf) => {
    mannequinModel = gltf.scene;
    
    const box = new THREE.Box3().setFromObject(mannequinModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    mannequinModel.position.x = -center.x;
    mannequinModel.position.y = -box.min.y;
    mannequinModel.position.z = -center.z;
    
    const scale = 1.8 / size.y;
    mannequinModel.scale.set(scale, scale, scale);
    
    mannequinModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    threeScene.add(mannequinModel);
    
    threeControls.target.set(0, 0.9, 0);
    threeCamera.position.set(0, 1.2, 3);
    threeControls.update();
    
    console.log('✅ Mannequin loaded');
  }, undefined, (error) => {
    console.error('❌ Error loading mannequin:', error);
    showToast('خطأ في تحميل المانيكان');
  });

  // 7. أنيميشن
  function animate() {
    requestAnimationFrame(animate);
    threeControls.update();
    threeRenderer.render(threeScene, threeCamera);
  }
  animate();

  // 8. التعامل مع تغيير حجم الشاشة
  window.addEventListener('resize', () => {
    if (!threeRenderer || !container) return;
    threeCamera.aspect = container.clientWidth / container.clientHeight;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(container.clientWidth, container.clientHeight);
  });

  // 9. تجهيز قوائم اختيار التيشيرتات والبناطيل
  populateTryOnSelectors();
}

function populateTryOnSelectors() {
  const tshirtSelector = document.getElementById('tryOnTshirtSelector');
  const pantsSelector = document.getElementById('tryOnPantsSelector');
  if (!tshirtSelector || !pantsSelector) return;

  const tshirts = products.filter(p => p.category === 'tshirts');
  const pants = products.filter(p => p.category === 'pants');

  function renderSelector(container, items, type) {
    if (items.length === 0) {
      container.innerHTML = '<p style="font-size:0.85rem; color:var(--text-soft);">لا توجد منتجات متاحة</p>';
      return;
    }
    container.innerHTML = items.map(p => `
      <div class="try-on-item" data-id="${p.id}" data-type="${type}" title="${escapeHtml(p.name)}">
        <img src="${escapeHtml(buildImageUrl(p.image, p.name))}" alt="${escapeHtml(p.name)}">
      </div>
    `).join('');

    container.querySelectorAll('.try-on-item').forEach(item => {
      item.addEventListener('click', () => {
        container.querySelectorAll('.try-on-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const id = parseInt(item.dataset.id);
        const prod = products.find(x => x.id === id);
        
        if (type === 'tshirt') {
          selectedTshirt = prod;
        } else {
          selectedPants = prod;
        }
        
        applyClothingToMannequin();
      });
    });
  }

  renderSelector(tshirtSelector, tshirts, 'tshirt');
  renderSelector(pantsSelector, pants, 'pants');
}

function applyClothingToMannequin() {
  if (!mannequinModel) return;
  
  // ملحوظة: لتطبيق الصور على المانيكان فعلياً في Three.js، محتاجين نستخدم TextureLoader ونحدد أماكن الـ UV mapping على المانيكان.
  // ده بيحتاج تحديد الـ Meshes الخاصة بالجسم بدقة.
  // دلوقتي هنعرض في الـ Console بس عشان نتأكد إن الاختيار شغال.
  
  console.log('Selected T-shirt:', selectedTshirt?.name);
  console.log('Selected Pants:', selectedPants?.name);
}

init();