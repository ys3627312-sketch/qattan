// =====================================================
// QATTAN — Store Script (Firebase Edition — URLs Only + i18n)
// =====================================================

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
let cart = [];
let favorites = [];

let currentCategory = 'tshirts';
let currentSearchQuery = '';
let currentSortValue = 'default';
let lastProductId = null;

let isAdminLoggedIn = false;
let currentOrdersFilter = 'all';

// اللغة الحالية
let currentLang = localStorage.getItem('qattan_lang') || 'ar';

const STORAGE_KEYS = {
  cart: 'qattan_cart',
  favorites: 'qattan_favorites',
  darkMode: 'qattan_darkMode',
  lastProduct: 'qattan_lastProduct',
  clientId: 'qattan_clientId',
  lang: 'qattan_lang'
};

const MAX_QTY = 10;

const AVAILABLE_COLORS = [
  { id: 'black', name: 'أسود', nameEn: 'Black', hex: '#1a1a1a' },
  { id: 'white', name: 'أبيض', nameEn: 'White', hex: '#ffffff' },
  { id: 'blue', name: 'أزرق', nameEn: 'Blue', hex: '#3498db' },
  { id: 'red', name: 'أحمر', nameEn: 'Red', hex: '#e74c3c' },
  { id: 'green', name: 'أخضر', nameEn: 'Green', hex: '#27ae60' },
  { id: 'yellow', name: 'أصفر', nameEn: 'Yellow', hex: '#f1c40f' },
  { id: 'navy', name: 'كحلي', nameEn: 'Navy', hex: '#34495e' },
  { id: 'gray', name: 'رمادي', nameEn: 'Gray', hex: '#7f8c8d' },
  { id: 'beige', name: 'بيج', nameEn: 'Beige', hex: '#d4c4a8' },
  { id: 'brown', name: 'بني', nameEn: 'Brown', hex: '#8b5a2b' },
  { id: 'pink', name: 'وردي', nameEn: 'Pink', hex: '#e91e63' },
  { id: 'purple', name: 'بنفسجي', nameEn: 'Purple', hex: '#9b59b6' },
  { id: 'orange', name: 'برتقالي', nameEn: 'Orange', hex: '#e67e22' }
];

const colorHexMap = AVAILABLE_COLORS.reduce((acc, c) => {
  acc[c.name] = c.hex;
  return acc;
}, {});

// =====================================================
// قاموس الترجمة
// =====================================================
const translations = {
  ar: {
    home: 'المنتجات', new: 'وصل حديثاً', offers: 'العروض', favorites: 'المفضلة', orders: 'طلباتي',
    all: 'الكل', tshirts: 'تيشيرتات', pants: 'بناطيل', shoes: 'أحذية',
    addToCart: 'أضف إلى السلة', outOfStock: 'غير متوفر', size: 'المقاس', color: 'اللون',
    sortDefault: 'ترتيب افتراضي', sortLow: 'الأرخص أولاً', sortHigh: 'الأغلى أولاً', sortRating: 'الأعلى تقييماً',
    checkout: 'إتمام الطلب', total: 'الإجمالي', cartEmpty: 'سلة فارغة',
    searchPlaceholder: 'ابحث...', sizeGuide: 'دليل المقاسات',
    heroTitle: 'أناقة بلا مجهود', heroSub: 'ملابس مختارة بعناية لتناسب كل لحظة في يومك.',
    shopNow: 'تسوق الآن', newArrivals: 'وصل حديثاً', viewAll: 'عرض الكل',
    contact: 'تواصل معنا', allProducts: 'كل المنتجات', footerRights: 'جميع الحقوق محفوظة',
    currency: 'ج.م', availableColors: 'اللون المتاح', soldOut: 'نفذ',
    reviews: 'التقييمات', addReview: 'أضف تقييمك', yourName: 'اسمك', yourReview: 'رأيك (اختياري)',
    submitReview: 'إرسال التقييم', relatedProducts: 'منتجات مشابهة'
  },
  en: {
    home: 'Products', new: 'New Arrivals', offers: 'Offers', favorites: 'Favorites', orders: 'My Orders',
    all: 'All', tshirts: 'T-Shirts', pants: 'Pants', shoes: 'Shoes',
    addToCart: 'Add to Cart', outOfStock: 'Out of Stock', size: 'Size', color: 'Color',
    sortDefault: 'Default Sort', sortLow: 'Price: Low to High', sortHigh: 'Price: High to Low', sortRating: 'Top Rated',
    checkout: 'Checkout', total: 'Total', cartEmpty: 'Your cart is empty',
    searchPlaceholder: 'Search...', sizeGuide: 'Size Guide',
    heroTitle: 'Effortless Elegance', heroSub: 'Carefully curated clothing for every moment of your day.',
    shopNow: 'Shop Now', newArrivals: 'New Arrivals', viewAll: 'View All',
    contact: 'Contact Us', allProducts: 'All Products', footerRights: 'All rights reserved',
    currency: 'EGP', availableColors: 'Available Colors', soldOut: 'Sold Out',
    reviews: 'Reviews', addReview: 'Add Your Review', yourName: 'Your Name', yourReview: 'Your Review (Optional)',
    submitReview: 'Submit Review', relatedProducts: 'Related Products'
  }
};

function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) || key;
}

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
  return Number(n || 0).toLocaleString(currentLang === 'ar' ? 'ar-EG' : 'en-US');
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
    return `https://placehold.co/400x533/f0ebe1/1a1a1a?text=${encodeURIComponent(name || 'Product')}`;
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
    }
  } catch (e) {
    console.error('loadStoreData error:', e);
  }
}

async function saveStoreData() {
  try {
    const docRef = doc(db, 'storeData', 'main');
    await setDoc(docRef, { storeConfig, products, offers });
    console.log('✅ Store data saved successfully');
    return true;
  } catch (e) {
    console.error('❌ saveStoreData error:', e);
    let msg = currentLang === 'ar' ? 'فشل الحفظ في Firebase' : 'Failed to save in Firebase';
    if (e.code === 'permission-denied') {
      msg = currentLang === 'ar' ? 'غير مصرح بالحفظ — سجل دخول الأدمن تاني' : 'Unauthorized — please re-login as admin';
    } else if (e.code === 'unavailable') {
      msg = currentLang === 'ar' ? 'مشكلة في الاتصال — جرب تاني' : 'Connection issue — please try again';
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
// تطبيق إعدادات المتجر (نصوص ثابتة)
// =====================================================
function applyStoreConfig() {
  document.title = storeConfig.name + ' | ' + (currentLang === 'ar' ? 'ملابس بجودة عالية' : 'High-Quality Clothing');
  
  // الاسم العربي أو الإنجليزي حسب اللغة
  const displayName = (currentLang === 'en' && storeConfig.nameEn) ? storeConfig.nameEn : storeConfig.name;
  
  const el = document.getElementById('storeName');
  if (el) el.textContent = displayName;
  
  const drawerName = document.getElementById('drawerStoreName');
  if (drawerName) drawerName.textContent = displayName;
  
  // الاسم الإنجليزي (البراند تاج)
  const brandTag = document.querySelector('.brand-tag');
  if (brandTag) brandTag.textContent = (storeConfig.nameEn || storeConfig.name || 'QATTAN').toUpperCase();
  
  const drawerBrandTag = document.querySelector('.drawer-brand-tag');
  if (drawerBrandTag) drawerBrandTag.textContent = (storeConfig.nameEn || storeConfig.name || 'QATTAN').toUpperCase();
  
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
    footerText.textContent = `© 2025 ${displayName} | ${t('footerRights')}`;
  }
}

// =====================================================
// تطبيق اللغة
// =====================================================
function applyLanguage() {
  const html = document.documentElement;
  
  html.lang = currentLang;
  html.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.toggle('ltr-mode', currentLang === 'en');
  
  // ترجمة أزرار النافبار
  const navMap = { home: 'home', new: 'new', offers: 'offers', favorites: 'favorites', orders: 'orders' };
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const key = btn.dataset.page;
    if (key && t(key)) {
      const span = btn.querySelector('span');
      if (span) span.textContent = t(key);
      else btn.textContent = t(key);
    }
  });
  
  // ترجمة أزرار الـ Drawer
  document.querySelectorAll('.drawer-nav-btn').forEach(btn => {
    const key = btn.dataset.drawerPage;
    if (key && t(key)) {
      const span = btn.querySelector('span');
      if (span) span.textContent = t(key);
    }
  });
  
  // ترجمة فلاتر الأقسام
  document.querySelectorAll('.cat-pill').forEach(pill => {
    const cat = pill.dataset.cat;
    if (t(cat)) pill.textContent = t(cat);
  });
  
  // ترجمة قائمة الترتيب
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.options[0].text = t('sortDefault');
    sortSelect.options[1].text = t('sortLow');
    sortSelect.options[2].text = t('sortHigh');
    sortSelect.options[3].text = t('sortRating');
  }
  
  // ترجمة البحث
  const searchInput = document.getElementById('menuSearch');
  if (searchInput) searchInput.placeholder = t('searchPlaceholder');
  
  // ترجمة الهيرو
  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) heroTitle.textContent = t('heroTitle');
  const heroSub = document.querySelector('.hero-subtitle');
  if (heroSub) heroSub.textContent = t('heroSub');
  const heroShop = document.getElementById('heroShopBtn');
  if (heroShop) heroShop.textContent = t('shopNow');
  const heroNew = document.getElementById('heroNewBtn');
  if (heroNew) heroNew.textContent = t('newArrivals');
  
  // ترجمة عناوين الأقسام الثابتة
  document.querySelectorAll('.section-title').forEach(el => {
    if (el.dataset.translate === 'newArrivals' || el.textContent.includes('وصل حديثاً') || el.textContent.includes('New Arrivals')) {
      el.textContent = t('newArrivals');
    }
  });
  
  // ترجمة زرار عرض الكل
  document.querySelectorAll('.section-link').forEach(link => {
    if (link.dataset.page === 'new') {
      link.innerHTML = `${t('viewAll')} <i class="fas fa-arrow-left"></i>`;
    }
  });
  
  // ترجمة الـ breadcrumbs
  const bcHome = document.querySelector('.breadcrumbs a[data-page="home"]');
  if (bcHome) bcHome.textContent = currentLang === 'ar' ? 'الرئيسية' : 'Home';
  
  // ترجمة السلة
  const checkoutBtn = document.getElementById('confirmOrderBtn');
  if (checkoutBtn) {
    checkoutBtn.innerHTML = `<i class="fas fa-arrow-left"></i> ${t('checkout')}`;
  }
  const clearCartBtn = document.getElementById('clearCartBtn');
  if (clearCartBtn) {
    clearCartBtn.innerHTML = currentLang === 'ar' 
      ? '<i class="fas fa-trash-alt"></i> تفريغ السلة' 
      : '<i class="fas fa-trash-alt"></i> Clear Cart';
  }
  
  const cartHeader = document.querySelector('.cart-header h3');
  if (cartHeader) {
    cartHeader.innerHTML = currentLang === 'ar' 
      ? '<i class="fas fa-shopping-bag"></i> سلة المشتريات' 
      : '<i class="fas fa-shopping-bag"></i> Shopping Cart';
  }
  
  // إعادة تطبيق إعدادات المتجر (لتحديث الاسم)
  applyStoreConfig();
  
  // إعادة رسم المنتجات لتحديث الأسعار والـ currency
  renderProducts();
  renderNewArrivals();
  renderFeatured();
  renderOffers();
  renderFavorites();
  renderCart();
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
    badge = `<span class="product-badge unavailable">${t('outOfStock')}</span>`;
  } else if (hasOffer) {
    const disc = Math.round((1 - p.offerPrice / p.price) * 100);
    badge = `<span class="product-badge sale">-${disc}%</span>`;
  } else if (p.isNew) {
    badge = `<span class="product-badge new">${currentLang === 'ar' ? 'جديد' : 'New'}</span>`;
  }
  
  return `
    <div class="product-card" data-id="${p.id}">
      <div class="product-image-wrap">
        ${badge}
        <button class="fav-btn ${isFav ? 'active' : ''}" data-fav-id="${p.id}" aria-label="favorite">
          <i class="fas fa-heart"></i>
        </button>
        <img class="product-image" src="${escapeHtml(buildImageUrl(p.image, p.name))}" alt="${escapeHtml(p.name)}" loading="lazy">
        <button class="quick-view-btn" data-qv-id="${p.id}">${currentLang === 'ar' ? 'عرض سريع' : 'Quick View'}</button>
      </div>
      <div class="product-info">
        <p class="product-category-label">${t(p.category) || ''}</p>
        <h3 class="product-name">${escapeHtml(p.name)}</h3>
        <div class="product-rating">
          <div class="stars">${renderStars(p.avgRating || 0)}</div>
          <span class="rating-count">(${p.totalRatings || 0})</span>
        </div>
        <div class="product-price ${hasOffer ? 'sale-price' : ''}">
          ${formatPrice(finalPrice)} ${t('currency')}
          ${hasOffer ? `<span class="old-price">${formatPrice(p.price)} ${t('currency')}</span>` : ''}
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
  if (titleEl) titleEl.textContent = t(currentCategory) || t('home');
  
  const countEl = document.getElementById('resultsCount');
  if (countEl) countEl.textContent = currentLang === 'ar' 
    ? `${filtered.length} منتج` 
    : `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <p>${currentLang === 'ar' ? 'لا توجد منتجات في هذا القسم' : 'No products in this category'}</p>
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
    container.innerHTML = `<div class="empty-state"><p>${currentLang === 'ar' ? 'لا توجد منتجات مميزة' : 'No featured products'}</p></div>`;
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
    container.innerHTML = `<div class="empty-state"><p>${currentLang === 'ar' ? 'لا توجد منتجات جديدة' : 'No new arrivals'}</p></div>`;
    return;
  }
  
  container.innerHTML = newOnes.map(renderProductCard).join('');
  bindProductEvents(container);
}

function renderOffers() {
  const container = document.getElementById('offersContainer');
  if (!container) return;
  
  if (offers.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-tags"></i><p>${currentLang === 'ar' ? 'لا توجد عروض حالياً' : 'No offers currently'}</p></div>`;
    return;
  }
  
  container.innerHTML = offers.map(o => `
    <div class="offer-card">
      <span class="offer-tag">${escapeHtml(o.tag || (currentLang === 'ar' ? 'عرض' : 'Offer'))}</span>
      <h3 class="offer-title">${escapeHtml(o.title || '')}</h3>
      <p class="offer-desc">${escapeHtml(o.desc || '')}</p>
      ${o.isAvailable !== false && o.productId ? `
        <button class="offer-action" data-offer-pid="${o.productId}">${currentLang === 'ar' ? 'اكتشف العرض' : 'Discover Offer'}</button>
      ` : `<span style="opacity:0.5;">${t('outOfStock')}</span>`}
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
        <p>${currentLang === 'ar' ? 'لا توجد منتجات في المفضلة' : 'No favorites yet'}</p>
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
    showToast(currentLang === 'ar' ? 'تمت الإضافة للمفضلة' : 'Added to favorites'); 
  } else { 
    favorites.splice(idx, 1); 
    showToast(currentLang === 'ar' ? 'تمت الإزالة من المفضلة' : 'Removed from favorites'); 
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
        ${t(p.category) || ''}
      </p>
      <h2>${escapeHtml(p.name)}</h2>
      <div class="product-details-rating">
        <div class="stars">${renderStars(p.avgRating || 0)}</div>
        <span class="count">(${p.totalRatings || 0} ${currentLang === 'ar' ? 'تقييم' : 'reviews'})</span>
      </div>
      <div class="product-details-price ${hasOffer ? 'sale-price' : ''}">
        ${formatPrice(finalPrice)} ${t('currency')}
        ${hasOffer ? `<span class="old">${formatPrice(p.price)} ${t('currency')}</span>` : ''}
      </div>
      <p style="font-size:0.88rem;color:var(--text-soft);line-height:1.7;">
        ${escapeHtml((p.description || '').substring(0, 100))}...
      </p>
      <button class="btn-primary" style="width:100%;margin-top:auto;" onclick="window.__quickViewGo(${p.id})">
        ${currentLang === 'ar' ? 'عرض التفاصيل الكاملة' : 'View Full Details'}
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
  if (bcCat) bcCat.textContent = t(p.category) || '';
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
              <strong><span class="store-badge">${currentLang === 'ar' ? 'إدارة المتجر' : 'Store Admin'}</span> ${escapeHtml(reply.userName || 'Store')}</strong>
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
            <div class="review-date">${new Date(r.date).toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US')}</div>
          </div>
          ${r.comment ? `<p class="review-comment">${escapeHtml(r.comment)}</p>` : ''}
          ${repliesHtml}
        </div>
      `;
    }).join('');
  } else {
    reviewsHtml = `<div class="no-reviews">${currentLang === 'ar' ? 'لا توجد تقييمات بعد، كن أول من يقيم!' : 'No reviews yet, be the first!'}</div>`;
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
        ${t(p.category) || ''}
      </p>
      <h1 class="product-details-title">${escapeHtml(p.name)}</h1>
      
      <div class="product-details-rating">
        <div class="stars">${renderStars(p.avgRating || 0)}</div>
        <span class="count">(${p.totalRatings || 0} ${currentLang === 'ar' ? 'تقييم' : 'reviews'})</span>
      </div>
      
      <div class="product-details-price ${hasOffer ? 'sale-price' : ''}" id="mainPriceDisplay">
        ${formatPrice(finalPrice)} ${t('currency')}
        ${hasOffer ? `<span class="old">${formatPrice(p.price)} ${t('currency')}</span>` : ''}
      </div>
      
      <p class="product-description">${escapeHtml(p.description || '')}</p>
      
      ${p.sizes && p.sizes.length ? `
        <div class="option-section">
          <div class="option-header">
            <span class="option-label">${t('size')}</span>
            <button class="size-guide-link" onclick="document.getElementById('sizeGuideModal').classList.add('show')">
              <i class="fas fa-ruler"></i> ${t('sizeGuide')}
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
                  ${isOut ? `<br><small style="font-size:0.65rem;">${t('soldOut')}</small>` : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
        
        <div class="option-section" id="colorSection">
          <div class="option-header"><span class="option-label">${t('availableColors')}</span></div>
          <div class="color-selector" id="dynamicColors"></div>
        </div>
      ` : ''}
      
      <div class="product-actions">
        <button class="btn-add-cart" id="addToCartBtn" ${!isAvail ? 'disabled' : ''}>
          <i class="fas fa-shopping-bag"></i>
          ${isAvail ? t('addToCart') : t('outOfStock')}
        </button>
        <button class="btn-wishlist ${isFav ? 'active' : ''}" id="wishlistBtn" aria-label="favorite">
          <i class="fas fa-heart"></i>
        </button>
      </div>
      
      <div class="reviews-section">
        <h3>${t('reviews')}</h3>
        <div class="reviews-list">${reviewsHtml}</div>
        <div class="add-review-form">
          <h4>${t('addReview')}</h4>
          <div class="rating-input" id="ratingInput">
            ${[1,2,3,4,5].map(s => `<i class="fas fa-star star" data-rating="${s}"></i>`).join('')}
          </div>
          <input type="text" id="reviewName" class="review-name-input" placeholder="${t('yourName')}">
          <textarea id="reviewComment" class="review-comment-input" placeholder="${t('yourReview')}"></textarea>
          <button class="btn-submit-review" id="submitReviewBtn">${t('submitReview')}</button>
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
      priceDisplay.innerHTML = `${formatPrice(matrix.price)} ${t('currency')}`;
      if (hasOffer && p.offerPrice < p.price) {
        priceDisplay.innerHTML += ` <span class="old">${formatPrice(p.price)} ${t('currency')}</span>`;
      }
    }
    
    if (dynamicColors) {
      if (matrix.colors && matrix.colors.length > 0) {
        dynamicColors.innerHTML = matrix.colors.map((cName, i) => {
          const colorObj = AVAILABLE_COLORS.find(ac => ac.name === cName);
          const displayName = (currentLang === 'en' && colorObj) ? colorObj.nameEn : cName;
          return `
            <button class="color-swatch ${i === 0 ? 'selected' : ''}" 
              data-color-name="${escapeHtml(cName)}" 
              style="background:${colorHexMap[cName] || '#ccc'};" 
              title="${escapeHtml(displayName)}"></button>
          `;
        }).join('');
        
        selColorName = matrix.colors[0];
        
        dynamicColors.querySelectorAll('.color-swatch').forEach(sw => {
          sw.addEventListener('click', () => {
            dynamicColors.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
            sw.classList.add('selected');
            selColorName = sw.dataset.colorName;
          });
        });
      } else {
        dynamicColors.innerHTML = `<p style="font-size:0.85rem;color:var(--danger);">${currentLang === 'ar' ? 'لا توجد ألوان متاحة لهذا المقاس' : 'No colors available for this size'}</p>`;
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
      showToast(currentLang === 'ar' ? 'اختر مقاس أولاً' : 'Please select a size first');
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
    if (!name) { showToast(currentLang === 'ar' ? 'الرجاء إدخال اسمك' : 'Please enter your name'); return; }
    if (selectedRating === 0) { showToast(currentLang === 'ar' ? 'الرجاء اختيار تقييم' : 'Please select a rating'); return; }
    
    if (!p.ratings) p.ratings = [];
    p.ratings.push({ userName: name, rating: selectedRating, comment, date: new Date().toISOString() });
    p.avgRating = p.ratings.reduce((s, r) => s + r.rating, 0) / p.ratings.length;
    p.totalRatings = p.ratings.length;
    
    const saved = await saveStoreData();
    if (saved) {
      showToast(currentLang === 'ar' ? 'شكراً لتقييمك!' : 'Thanks for your review!');
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
      <button class="lightbox-close" aria-label="close">
        <i class="fas fa-times"></i>
      </button>
      <img src="" alt="Product Image">
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
    showToast(currentLang === 'ar' ? 'هذا المنتج غير متوفر' : 'This product is out of stock');
    return;
  }
  
  if (size && product.sizeMatrix) {
    const matrix = product.sizeMatrix[size];
    if (matrix && matrix.qty <= 0) {
      showToast(currentLang === 'ar' ? 'هذا المقاس غير متوفر' : 'This size is out of stock');
      return;
    }
  }
  
  const variantKey = `${product.id}_${size || ''}_${color?.name || ''}`;
  const existing = cart.find(c => c.variantKey === variantKey);
  const finalPrice = customPrice || product.offerPrice || product.price;
  
  if (existing) {
    if (existing.quantity + qty > MAX_QTY) {
      showToast(currentLang === 'ar' ? `لا يمكنك طلب أكثر من ${MAX_QTY} قطع` : `You can't order more than ${MAX_QTY} pieces`);
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
  showToast(currentLang === 'ar' ? 'تمت الإضافة إلى السلة' : 'Added to cart');
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
  if (newQty > MAX_QTY) { showToast(currentLang === 'ar' ? `الحد الأقصى ${MAX_QTY}` : `Max ${MAX_QTY}`); return; }
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
    container.innerHTML = `<div class="empty-state"><i class="fas fa-shopping-basket"></i><p>${t('cartEmpty')}</p></div>`;
    if (totalEl) totalEl.textContent = `${t('total')}: 0 ${t('currency')}`;
    return;
  }
  
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-image" src="${escapeHtml(buildImageUrl(item.image, item.name))}" alt="${escapeHtml(item.name)}">
      <div class="cart-item-content">
        <div class="cart-item-title">${escapeHtml(item.name)}</div>
        ${item.size || item.color ? `
          <div class="cart-item-variant">
            ${item.size ? `${t('size')}: ${escapeHtml(item.size)}` : ''}
            ${item.size && item.color ? ' • ' : ''}
            ${item.color ? `${t('color')}: ${escapeHtml(item.color)}` : ''}
          </div>
        ` : ''}
        <div class="cart-item-bottom">
          <div class="cart-qty-controls">
            <button class="cart-qty-btn" data-minus="${escapeHtml(item.variantKey)}"><i class="fas fa-minus"></i></button>
            <span class="cart-qty-value">${item.quantity}</span>
            <button class="cart-qty-btn" data-plus="${escapeHtml(item.variantKey)}"><i class="fas fa-plus"></i></button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="cart-item-price">${formatPrice(item.price * item.quantity)} ${t('currency')}</span>
            <button class="cart-remove" data-remove="${escapeHtml(item.variantKey)}"><i class="fas fa-times"></i></button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  
  const total = calcCartTotal();
  if (totalEl) totalEl.textContent = `${t('total')}: ${formatPrice(total)} ${t('currency')}`;
  
  container.querySelectorAll('[data-plus]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.plus, 1)));
  container.querySelectorAll('[data-minus]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.minus, -1)));
  container.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.remove)));
}

// =====================================================
// إرسال الطلب
// =====================================================
function validatePhone(phone) {
  if (!phone) return { valid: false };
  if (phone.length !== 10) return { valid: false, reason: currentLang === 'ar' ? 'الرقم لازم 10 أرقام' : 'Phone must be 10 digits' };
  const networks = { '010': 'Vodafone', '011': 'Etisalat', '012': 'Orange', '015': 'WE' };
  if (!networks[phone.substring(0, 3)]) return { valid: false, reason: currentLang === 'ar' ? 'كود الشبكة غير صحيح' : 'Invalid network code' };
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
    showToast(currentLang === 'ar' ? 'الرجاء ملء جميع البيانات' : 'Please fill all fields');
    return;
  }
  
  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.valid) {
    showToast(phoneCheck.reason || (currentLang === 'ar' ? 'رقم غير صحيح' : 'Invalid phone'));
    return;
  }
  
  const total = calcCartTotal();
  const summary = cart.map(c => `${c.name} ×${c.quantity}`).join(' · ');
  const fullAddress = `${city} - ${address}`;
  
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
    showToast(currentLang === 'ar' ? 'فشل إرسال الطلب — حاول مرة تانية' : 'Failed to send order — try again');
    return;
  }
  
  let msg = `${currentLang === 'ar' ? 'طلب جديد من' : 'New order from'} ${storeConfig.name}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n`;
  cart.forEach(c => {
    msg += `• ${c.name}`;
    if (c.size) msg += ` (${c.size})`;
    if (c.color) msg += ` - ${c.color}`;
    msg += ` ×${c.quantity} = ${c.price * c.quantity} ${t('currency')}\n`;
  });
  msg += `━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${t('total')}: ${total} ${t('currency')}\n`;
  msg += `${currentLang === 'ar' ? 'الاسم' : 'Name'}: ${name}\n`;
  msg += `${currentLang === 'ar' ? 'الهاتف' : 'Phone'}: ${phoneCheck.full}\n`;
  msg += `${currentLang === 'ar' ? 'المنطقة' : 'Area'}: ${city}\n`;
  msg += `${currentLang === 'ar' ? 'العنوان' : 'Address'}: ${address}\n`;
  msg += `${currentLang === 'ar' ? 'الدفع' : 'Payment'}: ${payment}\n`;
  if (notes) msg += `${currentLang === 'ar' ? 'ملاحظات' : 'Notes'}: ${notes}\n`;
  
  cart = [];
  saveCart();
  renderCart();
  updateCartCount();
  closeModal('orderModal');
  showToast(currentLang === 'ar' ? 'تم إرسال الطلب بنجاح' : 'Order sent successfully');
  playSound();
  
  window.open(`https://wa.me/${storeConfig.phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

// =====================================================
// طلبات العميل
// =====================================================
function getStatusInfo(s) {
  const statusMap = {
    'new': { ar: 'جديد', en: 'New', class: 'status-new' },
    'processing': { ar: 'قيد التنفيذ', en: 'Processing', class: 'status-processing' },
    'completed': { ar: 'مكتمل', en: 'Completed', class: 'status-completed' },
    'cancelled': { ar: 'ملغي', en: 'Cancelled', class: 'status-cancelled' }
  };
  const info = statusMap[s] || statusMap['new'];
  return { label: currentLang === 'ar' ? info.ar : info.en, class: info.class };
}

async function renderCustomerOrders() {
  const container = document.getElementById('completedOrdersList');
  if (!container) return;
  
  container.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>${currentLang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p></div>`;
  
  const list = await loadOrdersFromFirebase('all', true);
  
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>${currentLang === 'ar' ? 'لا توجد طلبات حتى الآن' : 'No orders yet'}</p></div>`;
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
          <span class="order-date">${date.toLocaleString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
        <div class="order-meta">
          <span><i class="fas fa-user"></i> ${escapeHtml(order.customerName)}</span>
          <span><i class="fas fa-phone"></i> ${escapeHtml(order.customerPhoneLocal || order.customerPhone)}</span>
        </div>
        <div class="order-items">${escapeHtml(order.summary || '')}</div>
        <div class="order-total-row">
          <span>${t('total')}</span>
          <span>${formatPrice(order.total)} ${t('currency')}</span>
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
    const btn = document.getElementById('darkModeToggle');
    if (btn) btn.innerHTML = now ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
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
      hint.textContent = currentLang === 'ar' ? `رقم ${check.network} صحيح` : `${check.network} number is valid`;
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
const areasAr = ["مدينة نصر", "المعادي", "الدقي", "المهندسين", "الزمالك", "مصر الجديدة", "شبرا", "حلوان", "المقطم", "التجمع الخامس", "الشيخ زايد", "6 أكتوبر", "العبور", "عين شمس", "المطرية"];
const areasEn = ["Nasr City", "Maadi", "Dokki", "Mohandessin", "Zamalek", "Heliopolis", "Shubra", "Helwan", "Moqattam", "Fifth Settlement", "Sheikh Zayed", "6th of October", "Obour", "Ain Shams", "Matareya"];

function populateAreas() {
  const select = document.getElementById('city');
  if (!select) return;
  select.innerHTML = `<option value="">${currentLang === 'ar' ? 'اختر المنطقة' : 'Select Area'}</option>`;
  const areas = currentLang === 'ar' ? areasAr : areasEn;
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
        <h3><i class="fas fa-lock"></i> ${currentLang === 'ar' ? 'دخول الأدمن' : 'Admin Login'}</h3>
        <span class="modal-close" id="closeAdminLogin">&times;</span>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>${currentLang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
          <input type="email" id="adminEmail" class="modal-input" value="${escapeHtml(savedEmail)}" placeholder="email@gmail.com">
        </div>
        <div class="form-group">
          <label>${currentLang === 'ar' ? 'كلمة السر' : 'Password'}</label>
          <input type="password" id="adminPassword" class="modal-input" placeholder="${currentLang === 'ar' ? 'كلمة السر' : 'Password'}">
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;margin-top:10px;">
          <input type="checkbox" id="rememberMe" style="width:18px;height:18px;cursor:pointer;accent-color:var(--accent);" ${savedEmail ? 'checked' : ''}>
          <label for="rememberMe" style="margin:0;cursor:pointer;font-size:0.9rem;">${currentLang === 'ar' ? 'تذكرني' : 'Remember me'}</label>
        </div>
        <div id="adminLoginError" style="color:#e74c3c;font-size:0.85rem;margin-top:8px;display:none;"></div>
      </div>
      <div class="modal-footer">
        <button id="submitAdminLogin" class="btn-primary" style="width:100%;">${currentLang === 'ar' ? 'دخول' : 'Login'}</button>
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
    if (!em || !pw) { err.textContent = currentLang === 'ar' ? 'أدخل البيانات' : 'Please fill fields'; err.style.display = 'block'; return; }
    
    err.style.display = 'none';
    submit.disabled = true;
    submit.textContent = currentLang === 'ar' ? 'جاري الدخول...' : 'Logging in...';
    
    try {
      const cred = await signInWithEmailAndPassword(auth, em, pw);
      if (cred.user.email === ADMIN_EMAIL) {
        if (remember.checked) localStorage.setItem('qattan_savedEmail', em);
        else localStorage.removeItem('qattan_savedEmail');
        
        isAdminLoggedIn = true;
        document.body.classList.add('admin-logged-in');
        modal.remove();
        showAdminDashboard();
        showToast(currentLang === 'ar' ? 'تم تسجيل الدخول' : 'Logged in successfully');
      } else {
        err.textContent = currentLang === 'ar' ? 'غير مصرح' : 'Unauthorized';
        err.style.display = 'block';
        await signOut(auth);
      }
    } catch (e) {
      let m = currentLang === 'ar' ? 'خطأ في الدخول' : 'Login error';
      if (e.code === 'auth/user-not-found') m = currentLang === 'ar' ? 'الحساب غير موجود' : 'Account not found';
      else if (e.code === 'auth/wrong-password') m = currentLang === 'ar' ? 'كلمة السر خطأ' : 'Wrong password';
      else if (e.code === 'auth/invalid-email') m = currentLang === 'ar' ? 'إيميل غير صالح' : 'Invalid email';
      err.textContent = m;
      err.style.display = 'block';
    } finally {
      submit.disabled = false;
      submit.textContent = currentLang === 'ar' ? 'دخول' : 'Login';
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
  
  const isAr = currentLang === 'ar';
  
  const overlay = document.createElement('div');
  overlay.className = 'admin-panel-overlay show';
  overlay.innerHTML = `
    <div class="admin-dashboard">
      <div class="admin-top">
        <h2><i class="fas fa-store" style="color:var(--accent);margin-left:10px;"></i> ${isAr ? 'لوحة تحكم' : 'Dashboard'} ${escapeHtml(storeConfig.name)}</h2>
        <button id="closeAdminDash" class="admin-close-btn"><i class="fas fa-sign-out-alt"></i> ${isAr ? 'تسجيل الخروج' : 'Logout'}</button>
      </div>
      
      <div class="admin-tabs">
        <button class="admin-tab-btn active" data-tab="store"><i class="fas fa-cog"></i> ${isAr ? 'إعدادات المتجر' : 'Store Settings'}</button>
        <button class="admin-tab-btn" data-tab="products"><i class="fas fa-tshirt"></i> ${isAr ? 'المنتجات' : 'Products'}</button>
        <button class="admin-tab-btn" data-tab="offers"><i class="fas fa-tags"></i> ${isAr ? 'العروض' : 'Offers'}</button>
        <button class="admin-tab-btn" data-tab="orders"><i class="fas fa-shopping-bag"></i> ${isAr ? 'الطلبات' : 'Orders'}</button>
        <button class="admin-tab-btn" data-tab="reviews"><i class="fas fa-comments"></i> ${isAr ? 'التقييمات' : 'Reviews'}</button>
      </div>
      
      <!-- تبويب المعلومات -->
      <div id="tab-store" class="admin-tab-content active-tab">
        <div class="admin-section">
          <h3><i class="fas fa-store"></i> ${isAr ? 'بيانات المتجر' : 'Store Info'}</h3>
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'اسم المتجر (عربي)' : 'Store Name (Arabic)'}</label>
          <input type="text" id="editName" class="admin-input" value="${escapeHtml(storeConfig.name)}">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'اسم المتجر (إنجليزي)' : 'Store Name (English)'}</label>
          <input type="text" id="editNameEn" class="admin-input" value="${escapeHtml(storeConfig.nameEn || 'QATTAN')}" placeholder="QATTAN">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'رقم الواتساب' : 'WhatsApp Number'}</label>
          <input type="text" id="editPhone" class="admin-input" value="${escapeHtml(storeConfig.phone)}" placeholder="2010...">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'العنوان' : 'Address'}</label>
          <input type="text" id="editAddress" class="admin-input" value="${escapeHtml(storeConfig.address)}">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'ساعات العمل' : 'Working Hours'}</label>
          <input type="text" id="editHours" class="admin-input" value="${escapeHtml(storeConfig.workingHours)}">
          
          <button id="saveStoreBtn" class="admin-btn" style="width:100%;justify-content:center;margin-top:10px;">
            <i class="fas fa-save"></i> ${isAr ? 'حفظ الإعدادات' : 'Save Settings'}
          </button>
        </div>
      </div>
      
      <!-- تبويب المنتجات -->
      <div id="tab-products" class="admin-tab-content">
        <div class="admin-section">
          <h3><i class="fas fa-plus-circle"></i> ${isAr ? 'إضافة منتج جديد' : 'Add New Product'}</h3>
          <div class="admin-grid-2">
            <div>
              <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'اسم المنتج' : 'Product Name'}</label>
              <input type="text" id="newName" class="admin-input" placeholder="${isAr ? 'مثال: تيشيرت قطن' : 'e.g. Cotton T-Shirt'}">
            </div>
            <div>
              <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'الفئة' : 'Category'}</label>
              <select id="newCategory" class="admin-input">
                <option value="tshirts">${isAr ? 'تيشيرتات' : 'T-Shirts'}</option>
                <option value="pants">${isAr ? 'بناطيل' : 'Pants'}</option>
                <option value="shoes">${isAr ? 'أحذية' : 'Shoes'}</option>
              </select>
            </div>
          </div>
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'الوصف' : 'Description'}</label>
          <textarea id="newDesc" class="admin-input" rows="3" placeholder="${isAr ? 'وصف المنتج...' : 'Product description...'}"></textarea>

          <div style="margin-top: 15px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="newIsNew" style="width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer;" checked>
            <label for="newIsNew" style="font-weight: 700; font-size: 0.95rem; cursor: pointer;">${isAr ? 'هل هذا المنتج "وصل حديثاً"؟' : 'Is this a "New Arrival"?'}</label>
          </div>
          
          <div style="margin-top:20px; margin-bottom:20px; padding:15px; background:var(--bg-body); border-radius:12px; border:1px solid var(--border-color);">
            <label style="font-weight:700;font-size:0.9rem; margin-bottom:10px; display:block;">
              <i class="fas fa-link"></i> ${isAr ? 'روابط صور المنتج (يمكنك إضافة أكثر من صورة):' : 'Product Image URLs:'}
            </label>
            
            <div style="display:flex; gap:10px; margin-bottom:10px;">
              <input type="text" id="newImgUrlInput" class="admin-input" placeholder="${isAr ? 'ضع رابط صورة هنا...' : 'Paste image URL here...'}" style="margin-bottom:0;">
              <button type="button" id="addImgUrlBtn" class="admin-btn" style="padding:0 15px; white-space:nowrap;">${isAr ? 'إضافة' : 'Add'}</button>
            </div>
            
            <div id="galleryPreview" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;"></div>
          </div>

          <div id="newSizesContainer" style="margin-top:20px; padding:15px; background:var(--bg-body); border-radius:12px; border:1px solid var(--border-color);"></div>
          
          <button id="addProductBtn" class="admin-btn" style="width:100%;justify-content:center; margin-top:20px; padding:15px;">
            <i class="fas fa-plus"></i> ${isAr ? 'إضافة المنتج' : 'Add Product'}
          </button>
        </div>
        
        <div class="admin-section">
          <h3><i class="fas fa-list"></i> ${isAr ? 'المنتجات الحالية' : 'Current Products'}</h3>
          <div id="productsListAdmin"></div>
        </div>
      </div>
      
      <!-- تبويب العروض -->
      <div id="tab-offers" class="admin-tab-content">
        <div class="admin-section">
          <h3><i class="fas fa-plus-circle"></i> ${isAr ? 'إضافة عرض جديد' : 'Add New Offer'}</h3>
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'عنوان العرض' : 'Offer Title'}</label>
          <input type="text" id="newOfferTitle" class="admin-input" placeholder="${isAr ? 'خصم 20%' : '20% OFF'}">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'الوصف' : 'Description'}</label>
          <textarea id="newOfferDesc" class="admin-input" rows="2"></textarea>
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'نص التاج (مثال: خصم 20%)' : 'Tag text (e.g. 20% OFF)'}</label>
          <input type="text" id="newOfferTag" class="admin-input">
          
          <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'اختر المنتج' : 'Select Product'}</label>
          <select id="newOfferProduct" class="admin-input"></select>
          
          <button id="addOfferBtn" class="admin-btn" style="width:100%;justify-content:center;">
            <i class="fas fa-plus"></i> ${isAr ? 'إضافة العرض' : 'Add Offer'}
          </button>
        </div>
        
        <div class="admin-section">
          <h3><i class="fas fa-list"></i> ${isAr ? 'العروض الحالية' : 'Current Offers'}</h3>
          <div id="offersListAdmin"></div>
        </div>
      </div>
      
      <!-- تبويب الطلبات -->
      <div id="tab-orders" class="admin-tab-content">
        <div class="admin-section">
          <h3><i class="fas fa-shopping-bag"></i> ${isAr ? 'الطلبات الواردة' : 'Incoming Orders'}</h3>
          <div class="orders-filter-bar">
            <button class="orders-filter-btn active" data-filter="all">${isAr ? 'كل الطلبات' : 'All Orders'}</button>
            <button class="orders-filter-btn" data-filter="today">${isAr ? 'اليوم' : 'Today'}</button>
            <button class="orders-filter-btn" data-filter="week">${isAr ? 'آخر 7 أيام' : 'Last 7 days'}</button>
            <button class="orders-filter-btn" data-filter="month">${isAr ? 'آخر 30 يوم' : 'Last 30 days'}</button>
          </div>
          <div id="ordersListAdmin"></div>
        </div>
      </div>

      <!-- تبويب التقييمات -->
      <div id="tab-reviews" class="admin-tab-content">
        <div class="admin-section">
          <h3><i class="fas fa-comments"></i> ${isAr ? 'تقييمات العملاء' : 'Customer Reviews'}</h3>
          <div id="reviewsListAdmin"></div>
        </div>
      </div>
      
    </div>
  `;
  document.body.appendChild(overlay);
  
  overlay.querySelector('#closeAdminDash').onclick = async () => {
    try { await signOut(auth); } catch(e) {}
    closeAdminDashboard();
    showToast(isAr ? 'تم تسجيل الخروج' : 'Logged out');
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
    storeConfig.nameEn = overlay.querySelector('#editNameEn').value.trim() || 'QATTAN';
    storeConfig.phone = overlay.querySelector('#editPhone').value.trim();
    storeConfig.address = overlay.querySelector('#editAddress').value.trim();
    storeConfig.workingHours = overlay.querySelector('#editHours').value.trim();
    
    const btn = overlay.querySelector('#saveStoreBtn');
    btn.disabled = true;
    btn.innerHTML = isAr ? 'جاري الحفظ...' : 'Saving...';
    const saved = await saveStoreData();
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-save"></i> ${isAr ? 'حفظ الإعدادات' : 'Save Settings'}`;
    
    if (saved) {
      applyLanguage();
      showToast(isAr ? '✅ تم حفظ الإعدادات' : '✅ Settings saved');
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
  // إدارة المقاسات والأسعار والألوان
  // =====================================================
  const categorySelect = overlay.querySelector('#newCategory');
  const sizesContainer = overlay.querySelector('#newSizesContainer');

  function updateAdminSizes() {
    const cat = categorySelect.value;
    let sizesList = [];
    if (cat === 'tshirts') sizesList = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
    else if (cat === 'pants') sizesList = ['28', '30', '32', '34', '36', '38', '40', '42'];
    else if (cat === 'shoes') sizesList = ['38', '39', '40', '41', '42', '43', '44', '45'];

    let html = `<label style="font-weight:700;font-size:1rem;margin-bottom:10px;display:block;color:var(--accent);"><i class="fas fa-tags"></i> ${isAr ? 'إدارة المقاسات والألوان والأسعار:' : 'Sizes, Colors & Prices:'}</label>`;
    
    sizesList.forEach(size => {
      html += `
        <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:10px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:8px; margin-bottom:8px;">
            <strong style="font-size:1rem;">${isAr ? 'مقاس:' : 'Size:'} ${size}</strong>
            <div style="display:flex; gap:10px; align-items:center;">
               <label style="font-size:0.85rem; font-weight:700;">${isAr ? 'السعر:' : 'Price:'}</label>
               <input type="number" id="size_price_${size}" value="0" placeholder="${isAr ? 'سعر المقاس' : 'Size price'}" style="width:80px; padding:4px; border-radius:4px; border:1px solid var(--border-color); font-size:0.85rem;">
            </div>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:5px;">
              <input type="checkbox" id="size_chk_${size}" value="${size}" checked style="width:16px;height:16px;accent-color:var(--accent);">
              <span style="font-size:0.85rem;">${isAr ? 'متوفر' : 'Available'}</span>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
              <label style="font-size:0.85rem;">${isAr ? 'الكمية:' : 'Qty:'}</label>
              <input type="number" id="size_qty_${size}" value="10" min="0" style="width:50px; padding:4px; border-radius:4px; border:1px solid var(--border-color);">
            </div>
            
            <div style="width:100%; margin-top:8px; display:flex; gap:12px; flex-wrap:wrap;">
              ${AVAILABLE_COLORS.map(c => `
                <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                  <input type="checkbox" id="size_${size}_color_${c.id}" value="${c.name}" ${c.id === 'black' ? 'checked' : ''}> 
                  <span style="font-size:0.8rem; display:inline-block; width:12px; height:12px; border-radius:50%; background:${c.hex}; border:1px solid var(--border-color);"></span>
                  <span style="font-size:0.8rem;">${isAr ? c.name : c.nameEn}</span>
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
    
    if (!name) { showToast(isAr ? 'أدخل اسم المنتج' : 'Enter product name'); return; }
    if (galleryImages.length === 0) { showToast(isAr ? 'أضف رابط صورة واحد على الأقل' : 'Add at least one image URL'); return; }
    
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

    if (Object.keys(sizeMatrix).length === 0) { showToast(isAr ? 'اختر مقاس واحد على الأقل' : 'Select at least one size'); return; }
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
    btn.innerHTML = isAr ? 'جاري الحفظ...' : 'Saving...';
    const saved = await saveStoreData();
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-plus"></i> ${isAr ? 'إضافة المنتج' : 'Add Product'}`;
    
    if (!saved) {
      showToast(isAr ? '❌ فشل حفظ المنتج' : '❌ Failed to save product');
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
    showToast(isAr ? '✅ تم إضافة المنتج بنجاح' : '✅ Product added successfully');
  };
  
  overlay.querySelector('#addOfferBtn').onclick = async () => {
    const title = overlay.querySelector('#newOfferTitle').value.trim();
    const pid = parseInt(overlay.querySelector('#newOfferProduct').value);
    
    if (!title || !pid) { showToast(isAr ? 'أدخل البيانات' : 'Fill data'); return; }
    
    offers.push({ id: 'off_' + Date.now(), title, productId: pid, isAvailable: true });
    
    const btn = overlay.querySelector('#addOfferBtn');
    btn.disabled = true;
    btn.innerHTML = isAr ? 'جاري الحفظ...' : 'Saving...';
    const saved = await saveStoreData();
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-plus"></i> ${isAr ? 'إضافة العرض' : 'Add Offer'}`;
    
    if (saved) {
      renderOffersAdmin();
      renderOffers();
      showToast(isAr ? '✅ تم إضافة العرض' : '✅ Offer added');
    }
  };
  
  // =====================================================
  // عرض المنتجات في الأدمن
  // =====================================================
  function renderProductsAdmin() {
    const cont = overlay.querySelector('#productsListAdmin');
    if (!cont) return;

    if (products.length === 0) { 
      cont.innerHTML = `<p style="text-align:center;padding:20px;">${isAr ? 'لا توجد منتجات' : 'No products'}</p>`; 
      return; 
    }
    
    cont.innerHTML = products.map(p => `
      <div class="admin-product-row">
        <img src="${escapeHtml(buildImageUrl(p.image, p.name))}" class="admin-product-img">
        <div class="admin-product-info">
          <strong>${escapeHtml(p.name)}</strong>
          <span>${formatPrice(p.price)} ${t('currency')} — ${t(p.category)}</span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
          <button class="admin-edit-btn" data-edit="${p.id}" style="background:var(--accent-soft); color:var(--text-color); border:1px solid var(--border-color); padding:8px 16px; border-radius:50px; font-weight:700; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; gap:6px;"><i class="fas fa-edit"></i> ${isAr ? 'تعديل' : 'Edit'}</button>
          <button class="admin-del-btn" data-del="${p.id}"><i class="fas fa-trash"></i> ${isAr ? 'حذف' : 'Delete'}</button>
        </div>
      </div>
    `).join('');
    
    cont.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = parseInt(btn.dataset.del);
        showConfirm(isAr ? 'حذف المنتج نهائياً؟' : 'Delete product permanently?', async () => {
          products = products.filter(p => p.id !== id);
          const saved = await saveStoreData();
          if (saved) {
            renderProductsAdmin();
            renderProducts();
            renderFeatured();
            renderNewArrivals();
            showToast(isAr ? '✅ تم الحذف' : '✅ Deleted');
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

  // =====================================================
  // فتح صفحة تعديل المنتج
  // =====================================================
  function openEditProductModal(productId) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.zIndex = '100000';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:700px; max-height:90vh; overflow-y:auto;">
        <div class="modal-header" style="position:sticky; top:0; background:var(--card-bg); z-index:2;">
          <h3><i class="fas fa-edit"></i> ${isAr ? 'تعديل المنتج:' : 'Edit Product:'} ${escapeHtml(p.name)}</h3>
          <span class="modal-close" id="closeEditModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'اسم المنتج' : 'Product Name'}</label>
            <input type="text" id="editProdName" class="admin-input" value="${escapeHtml(p.name)}">
          </div>
          <div class="form-group">
            <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'الفئة' : 'Category'}</label>
            <select id="editProdCategory" class="admin-input">
              <option value="tshirts" ${p.category === 'tshirts' ? 'selected' : ''}>${isAr ? 'تيشيرتات' : 'T-Shirts'}</option>
              <option value="pants" ${p.category === 'pants' ? 'selected' : ''}>${isAr ? 'بناطيل' : 'Pants'}</option>
              <option value="shoes" ${p.category === 'shoes' ? 'selected' : ''}>${isAr ? 'أحذية' : 'Shoes'}</option>
            </select>
          </div>
          <div class="form-group">
            <label style="font-weight:700;font-size:0.9rem;margin-bottom:5px;display:block;">${isAr ? 'الوصف' : 'Description'}</label>
            <textarea id="editProdDesc" class="admin-input" rows="3">${escapeHtml(p.description || '')}</textarea>
          </div>

          <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="editIsNew" ${p.isNew ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer;">
            <label for="editIsNew" style="font-weight: 700; font-size: 0.95rem; cursor: pointer;">${isAr ? 'هل هذا المنتج "وصل حديثاً"؟' : 'Is this a "New Arrival"?'}</label>
          </div>

          <hr style="margin:15px 0; border:none; border-top:1px dashed var(--border-color);">

          <div style="margin-top:15px; margin-bottom:15px;">
            <label style="font-weight:700;font-size:0.9rem; margin-bottom:10px; display:block;">${isAr ? 'روابط صور المنتج:' : 'Product Image URLs:'}</label>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
              <input type="text" id="editImgUrlInput" class="admin-input" placeholder="${isAr ? 'ضع رابط صورة...' : 'Paste image URL...'}" style="margin-bottom:0;">
              <button type="button" id="editAddImgUrlBtn" class="admin-btn" style="padding:0 15px;">${isAr ? 'إضافة' : 'Add'}</button>
            </div>
            <div id="editGalleryPreview" style="display:flex; gap:8px; flex-wrap:wrap;"></div>
          </div>

          <hr style="margin:15px 0; border:none; border-top:1px dashed var(--border-color);">
          
          <div id="editSizesContainer" style="margin-top:15px;"></div>
        </div>
        <div class="modal-footer" style="position:sticky; bottom:0; background:var(--card-bg); z-index:2;">
          <button id="saveEditBtn" class="admin-btn" style="width:100%; justify-content:center; padding:14px;">
            <i class="fas fa-save"></i> ${isAr ? 'حفظ التعديلات' : 'Save Changes'}
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

      let html = `<label style="font-weight:700;font-size:1rem;margin-bottom:10px;display:block;color:var(--accent);"><i class="fas fa-tags"></i> ${isAr ? 'المقاسات والأسعار:' : 'Sizes & Prices:'}</label>`;
      
      sizesList.forEach(size => {
        const matrix = (p.sizeMatrix && p.sizeMatrix[size]) ? p.sizeMatrix[size] : { qty: 0, price: p.price || 0, colors: [] };
        const isChecked = !!(p.sizeMatrix && p.sizeMatrix[size]);
        
        html += `
          <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:10px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-color); padding-bottom:8px; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="edit_size_chk_${size}" value="${size}" ${isChecked ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent);">
                <strong style="font-size:1rem;">${isAr ? 'مقاس:' : 'Size:'} ${size}</strong>
              </div>
              <div style="display:flex; gap:10px; align-items:center;">
                <label style="font-size:0.85rem; font-weight:700;">${isAr ? 'السعر:' : 'Price:'}</label>
                <input type="number" id="edit_size_price_${size}" value="${matrix.price}" placeholder="${isAr ? 'سعر المقاس' : 'Size price'}" style="width:80px; padding:4px; border-radius:4px; border:1px solid var(--border-color); font-size:0.85rem;">
              </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:5px;">
                <label style="font-size:0.85rem;">${isAr ? 'الكمية:' : 'Qty:'}</label>
                <input type="number" id="edit_size_qty_${size}" value="${matrix.qty}" min="0" style="width:50px; padding:4px; border-radius:4px; border:1px solid var(--border-color);">
              </div>
              
              <div style="width:100%; margin-top:8px; display:flex; gap:12px; flex-wrap:wrap;">
                ${AVAILABLE_COLORS.map(c => {
                  const isColorChecked = matrix.colors && matrix.colors.includes(c.name);
                  return `
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                      <input type="checkbox" id="edit_size_${size}_color_${c.id}" value="${c.name}" ${isColorChecked ? 'checked' : ''}> 
                      <span style="font-size:0.8rem; display:inline-block; width:12px; height:12px; border-radius:50%; background:${c.hex}; border:1px solid var(--border-color);"></span>
                      <span style="font-size:0.8rem;">${isAr ? c.name : c.nameEn}</span>
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
      
      if (!newName) { showToast(isAr ? 'أدخل اسم المنتج' : 'Enter product name'); return; }
      if (editGalleryImages.length === 0) { showToast(isAr ? 'أضف رابط صورة واحد على الأقل' : 'Add at least one image URL'); return; }

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

      if (Object.keys(newSizeMatrix).length === 0) { showToast(isAr ? 'اختر مقاس واحد على الأقل' : 'Select at least one size'); return; }
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
      saveBtn.innerHTML = isAr ? 'جاري الحفظ...' : 'Saving...';
      const saved = await saveStoreData();
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i class="fas fa-save"></i> ${isAr ? 'حفظ التعديلات' : 'Save Changes'}`;

      if (saved) {
        modal.remove();
        renderProductsAdmin();
        renderProducts();
        renderFeatured();
        renderNewArrivals();
        showToast(isAr ? '✅ تم حفظ التعديلات بنجاح' : '✅ Changes saved');
      } else {
        showToast(isAr ? '❌ فشل الحفظ' : '❌ Failed to save');
      }
    };
  }
  
  function populateOfferProductSelect() {
    const sel = overlay.querySelector('#newOfferProduct');
    sel.innerHTML = products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }
  
  function renderOffersAdmin() {
    const cont = overlay.querySelector('#offersListAdmin');
    if (offers.length === 0) { cont.innerHTML = `<p style="text-align:center;padding:20px;">${isAr ? 'لا توجد عروض' : 'No offers'}</p>`; return; }
    
    cont.innerHTML = offers.map(o => `
      <div class="admin-product-row">
        <div class="admin-product-info">
          <strong>${escapeHtml(o.title)}</strong>
          <span>${escapeHtml(o.tag || '')}</span>
        </div>
        <button class="admin-del-btn" data-del="${o.id}"><i class="fas fa-trash"></i> ${isAr ? 'حذف' : 'Delete'}</button>
      </div>
    `).join('');
    
    cont.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.del;
        showConfirm(isAr ? 'حذف العرض؟' : 'Delete offer?', async () => {
          offers = offers.filter(o => o.id !== id);
          const saved = await saveStoreData();
          if (saved) {
            renderOffersAdmin();
            renderOffers();
            showToast(isAr ? '✅ تم الحذف' : '✅ Deleted');
          }
        });
      };
    });
  }
  
  async function renderOrdersAdmin() {
    const cont = overlay.querySelector('#ordersListAdmin');
    cont.innerHTML = `<p style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> ${isAr ? 'جاري التحميل...' : 'Loading...'}</p>`;
    
    const list = await loadOrdersFromFirebase(currentOrdersFilter, false);
    
    if (list.length === 0) { cont.innerHTML = `<p style="text-align:center;padding:20px;">${isAr ? 'لا توجد طلبات' : 'No orders'}</p>`; return; }
    
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
          <div style="font-weight:800;font-size:1.1rem;margin-bottom:15px;">${formatPrice(o.total)} ${t('currency')}</div>
          
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${o.status !== 'processing' ? `<button data-status="processing" data-oid="${o.firestoreId}" class="status-btn admin-btn" style="background:#3498db;padding:8px 15px;font-size:0.8rem;">${isAr ? 'قيد التنفيذ' : 'Processing'}</button>` : ''}
            ${o.status !== 'completed' ? `<button data-status="completed" data-oid="${o.firestoreId}" class="status-btn admin-btn" style="background:#27ae60;padding:8px 15px;font-size:0.8rem;">${isAr ? 'مكتمل' : 'Completed'}</button>` : ''}
            ${o.status !== 'cancelled' ? `<button data-status="cancelled" data-oid="${o.firestoreId}" class="status-btn admin-btn" style="background:#e74c3c;padding:8px 15px;font-size:0.8rem;">${isAr ? 'إلغاء' : 'Cancel'}</button>` : ''}
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
        showToast(isAr ? 'تم تحديث الحالة' : 'Status updated');
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
      cont.innerHTML = `<p style="text-align:center; padding:20px;">${isAr ? 'لا توجد تقييمات حتى الآن' : 'No reviews yet'}</p>`;
      return;
    }
    
    allReviews.sort((a, b) => new Date(b.review.date) - new Date(a.review.date));
    
    cont.innerHTML = allReviews.map(item => {
      const repliesHtml = (item.review.replies && item.review.replies.length > 0) ? item.review.replies.map(reply => `
        <div class="reply-item store-reply" style="margin-bottom:8px;">
          <strong style="font-size:0.8rem; display:block; margin-bottom:3px;">${isAr ? 'المتجر (إدارة):' : 'Store (Admin):'}</strong>
          <span style="font-size:0.9rem;">${escapeHtml(reply.text)}</span>
        </div>
      `).join('') : '';
      
      return `
        <div class="admin-review-card">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <strong style="color:var(--accent);">${escapeHtml(item.productName)}</strong>
            <span style="font-size:0.75rem; opacity:0.6;">${new Date(item.review.date).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span style="font-weight:700; font-size:0.9rem;">${escapeHtml(item.review.userName)}</span>
            <div class="stars">${renderStars(item.review.rating)}</div>
          </div>
          ${item.review.comment ? `<p style="font-size:0.9rem; margin-bottom:10px; color:var(--text-soft);">${escapeHtml(item.review.comment)}</p>` : ''}
          
          ${repliesHtml}
          
          <div class="admin-reply-box">
            <input type="text" placeholder="${isAr ? 'اكتب ردك هنا...' : 'Write your reply...'}" class="admin-reply-input" data-pid="${item.productId}" data-ridx="${item.reviewIdx}">
            <button class="admin-reply-btn" data-pid="${item.productId}" data-ridx="${item.reviewIdx}">${isAr ? 'رد' : 'Reply'}</button>
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
        
        if (!text) { showToast(isAr ? 'أدخل نص الرد' : 'Enter reply text'); return; }
        
        const product = products.find(p => p.id === pid);
        if (product && product.ratings && product.ratings[ridx]) {
          if (!product.ratings[ridx].replies) product.ratings[ridx].replies = [];
          product.ratings[ridx].replies.push({ text, userName: isAr ? "المتجر" : "Store", date: new Date().toISOString() });
          
          btn.disabled = true;
          btn.textContent = '...';
          const saved = await saveStoreData();
          if (saved) {
            renderReviewsAdmin();
            showToast(isAr ? '✅ تم إضافة الرد' : '✅ Reply added');
          } else {
            btn.disabled = false;
            btn.textContent = isAr ? 'رد' : 'Reply';
          }
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
  document.body.style.overflow = 'auto';
  
  loadLocalState();
  getClientId();
  setupDarkMode();
  setupPhoneInput();
  populateAreas();
  setupScrollTop();
  
  await loadStoreData();
  
  // تطبيق اللغة الحالية قبل أي حاجة
  applyLanguage();
  
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
    showConfirm(currentLang === 'ar' ? 'تفريغ السلة؟' : 'Clear cart?', () => {
      cart = [];
      saveCart();
      renderCart();
      updateCartCount();
      showToast(currentLang === 'ar' ? 'تم التفريغ' : 'Cart cleared');
    });
  });
  
  document.getElementById('confirmOrderBtn')?.addEventListener('click', () => {
    if (cart.length === 0) { showToast(t('cartEmpty')); return; }
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
    showToast(currentLang === 'ar' ? 'تم التحديث' : 'Updated');
  });
  
  // زرار تغيير اللغة
  document.getElementById('langToggle')?.addEventListener('click', () => {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    localStorage.setItem(STORAGE_KEYS.lang, currentLang);
    applyLanguage();
    populateAreas();
    showToast(currentLang === 'ar' ? 'اللغة: العربية' : 'Language: English');
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