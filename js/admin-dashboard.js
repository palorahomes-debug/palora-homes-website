/**
 * Palora Homes - Modern Store Administrator Dashboard Controller
 * Full-featured controller for Product Catalog, Orders, Customer Cart Tracking, Customer Directory, and Supabase RBAC
 */

(function (window, document) {
    'use strict';

    // Application State
    const state = {
        currentUser: null,
        currentProfile: null,
        isAdmin: false,
        activeView: 'overview',
        products: [],
        orders: [],
        cartActivity: [],
        customers: [],
        categories: [],
        productFilter: { search: '', category: 'all' },
        orderFilter: { search: '', status: 'all' },
        cartFilter: { search: '' },
        customerFilter: { search: '' }
    };

    // DOM Elements Cache
    const DOM = {};

    function cacheDOMElements() {
        DOM.loginGate = document.getElementById('adminLoginGate');
        DOM.loginForm = document.getElementById('adminLoginForm');
        DOM.loginEmail = document.getElementById('loginEmail');
        DOM.loginPassword = document.getElementById('loginPassword');
        DOM.loginError = document.getElementById('loginErrorAlert');
        DOM.loginSuccess = document.getElementById('loginSuccessAlert');
        DOM.loginTabSignIn = document.getElementById('tabBtnSignIn');
        DOM.loginTabSetup = document.getElementById('tabBtnSetup');
        DOM.loginPaneSignIn = document.getElementById('loginPaneSignIn');
        DOM.loginPaneSetup = document.getElementById('loginPaneSetup');
        DOM.formRegisterAdmin = document.getElementById('formRegisterAdmin');

        DOM.sidebar = document.getElementById('adminSidebar');
        DOM.sidebarToggle = document.getElementById('sidebarToggleBtn');
        DOM.navButtons = document.querySelectorAll('.sidebar-nav-btn');
        DOM.userEmail = document.getElementById('sidebarUserEmail');
        DOM.userAvatar = document.getElementById('sidebarUserAvatar');
        DOM.logoutBtns = document.querySelectorAll('.btn-logout-trigger');

        DOM.topTitle = document.getElementById('topNavTitle');
        DOM.topSub = document.getElementById('topNavSub');
        DOM.cloudBadge = document.getElementById('cloudStatusBadge');
        DOM.cloudBadgeText = document.getElementById('cloudStatusText');
        DOM.btnRefresh = document.getElementById('btnRefreshAll');

        // Overview KPI elements
        DOM.kpiProducts = document.getElementById('kpiTotalProducts');
        DOM.kpiOrders = document.getElementById('kpiTotalOrders');
        DOM.kpiPending = document.getElementById('kpiPendingOrders');
        DOM.kpiCompleted = document.getElementById('kpiCompletedOrders');
        DOM.kpiCustomers = document.getElementById('kpiTotalCustomers');
        DOM.kpiSales = document.getElementById('kpiTotalSales');
        DOM.overviewRecentOrders = document.getElementById('overviewRecentOrdersTable');
        DOM.overviewRecentCarts = document.getElementById('overviewRecentCartsTable');

        // Products view elements
        DOM.productsTableBody = document.getElementById('productsTableBody');
        DOM.productSearchInput = document.getElementById('productSearchInput');
        DOM.productCategorySelect = document.getElementById('productCategorySelect');
        DOM.btnOpenAddProduct = document.getElementById('btnOpenAddProductModal');
        DOM.btnSeedCatalog = document.getElementById('btnSeedCatalogToCloud');

        // Orders view elements
        DOM.ordersTableBody = document.getElementById('ordersTableBody');
        DOM.orderSearchInput = document.getElementById('orderSearchInput');
        DOM.orderStatusSelect = document.getElementById('orderStatusSelect');
        DOM.btnExportOrdersCSV = document.getElementById('btnExportOrdersCSV');
        DOM.btnBackupOrdersJSON = document.getElementById('btnBackupOrdersJSON');

        // Cart tracking view elements
        DOM.cartActivityTableBody = document.getElementById('cartActivityTableBody');
        DOM.cartSearchInput = document.getElementById('cartSearchInput');
        DOM.btnRefreshCartActivity = document.getElementById('btnRefreshCartActivity');

        // Customers view elements
        DOM.customersTableBody = document.getElementById('customersTableBody');
        DOM.customerSearchInput = document.getElementById('customerSearchInput');

        // Settings view elements
        DOM.settingSupabaseUrl = document.getElementById('settingSupabaseUrl');
        DOM.settingSupabaseKey = document.getElementById('settingSupabaseKey');
        DOM.settingAdminEmail = document.getElementById('settingAdminEmail');
        DOM.settingAdminRole = document.getElementById('settingAdminRole');
        DOM.btnTestNotif = document.getElementById('btnTestDesktopNotif');
        DOM.btnToggleNotif = document.getElementById('btnToggleDesktopNotif');

        // Modals
        DOM.productModal = document.getElementById('modalProductEdit');
        DOM.productForm = document.getElementById('formProductEdit');
        DOM.productModalTitle = document.getElementById('modalProductTitle');
        DOM.productImageFileInput = document.getElementById('productImageFileInput');

        DOM.orderModal = document.getElementById('modalOrderDetails');
        DOM.orderModalTitle = document.getElementById('orderModalTitle');
        DOM.orderModalDate = document.getElementById('orderModalDate');
        DOM.orderModalBody = document.getElementById('orderModalBody');
        DOM.orderStatusDropdown = document.getElementById('orderDetailStatusDropdown');
        DOM.orderAdminNotes = document.getElementById('orderDetailAdminNotes');
        DOM.btnSaveOrderStatus = document.getElementById('btnSaveOrderStatus');
        DOM.btnDownloadOrderPDF = document.getElementById('btnDownloadOrderPDF');
        DOM.btnChatOrderWhatsApp = document.getElementById('btnChatOrderWhatsApp');
        DOM.btnDeleteOrder = document.getElementById('btnDeleteOrder');

        DOM.cartModal = document.getElementById('modalCartInspect');
        DOM.cartModalBody = document.getElementById('cartInspectModalBody');

        DOM.toastPortal = document.getElementById('adminToastPortal');
    }

    // Helper: Escape HTML
    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Helper: Toast Notification
    function showToast(message, type) {
        if (!DOM.toastPortal) return;
        const toast = document.createElement('div');
        toast.className = 'admin-toast';
        if (type === 'error') {
            toast.style.borderLeftColor = '#DC2626';
        } else if (type === 'success') {
            toast.style.borderLeftColor = '#10B981';
        }
        toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✓'}</span> <span>${escapeHtml(message)}</span>`;
        DOM.toastPortal.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3600);
    }

    // Relative time helper
    function getRelativeTimeString(dateString) {
        if (!dateString) return 'recently';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return String(dateString);
        const diffMs = Date.now() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 45) return 'just now';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        return `${diffDay}d ago`;
    }

    // ====================================================================
    // AUTHENTICATION & LOGIN GATE CONTROLLER
    // ====================================================================
    async function checkAuthSession() {
        if (!window.PaloraSupabase || !window.PaloraSupabase.isConfigured()) {
            updateCloudStatus(false, 'Supabase credentials not configured in js/config.js');
            return;
        }

        try {
            const user = await window.PaloraSupabase.getCurrentUser();
            if (user) {
                state.currentUser = user;
                const profile = await window.PaloraSupabase.getProfile(user.id);
                state.currentProfile = profile;
                state.isAdmin = Boolean(profile && profile.role === 'admin') ||
                                user.email === 'palorahomes@gmail.com' ||
                                (user.user_metadata && user.user_metadata.role === 'admin');

                if (state.isAdmin) {
                    unlockDashboard();
                    return;
                } else {
                    showLoginError(`Logged in as ${user.email}, but this account has role "${(profile && profile.role) || 'customer'}". Store Administrator privileges required.`);
                    lockDashboard();
                    return;
                }
            } else {
                lockDashboard();
            }
        } catch (err) {
            console.error('PaloraAdmin: Session check error', err);
            lockDashboard();
        }
    }

    function lockDashboard() {
        if (DOM.loginGate) DOM.loginGate.classList.remove('hidden');
    }

    function unlockDashboard() {
        if (DOM.loginGate) DOM.loginGate.classList.add('hidden');
        if (DOM.userEmail && state.currentUser) {
            DOM.userEmail.textContent = state.currentUser.email || 'Store Admin';
            DOM.userEmail.title = state.currentUser.email || '';
        }
        if (DOM.userAvatar && state.currentUser) {
            const initial = (state.currentUser.email || 'A').charAt(0).toUpperCase();
            DOM.userAvatar.textContent = initial;
        }
        updateCloudStatus(true, 'Supabase Cloud Active');
        loadAllData();
    }

    function updateCloudStatus(connected, message) {
        if (!DOM.cloudBadge) return;
        if (connected) {
            DOM.cloudBadge.className = 'cloud-status-badge';
            DOM.cloudBadgeText.textContent = message || 'Supabase Cloud Connected';
        } else {
            DOM.cloudBadge.className = 'cloud-status-badge warning';
            DOM.cloudBadgeText.textContent = message || 'Supabase Awaiting Setup';
        }
    }

    function showLoginError(msg) {
        if (DOM.loginError) {
            DOM.loginError.textContent = msg;
            DOM.loginError.classList.add('visible');
        }
        if (DOM.loginSuccess) DOM.loginSuccess.classList.remove('visible');
    }

    function showLoginSuccess(msg) {
        if (DOM.loginSuccess) {
            DOM.loginSuccess.textContent = msg;
            DOM.loginSuccess.classList.add('visible');
        }
        if (DOM.loginError) DOM.loginError.classList.remove('visible');
    }

    function setupAuthListeners() {
        // Tab switching on Login Gate
        if (DOM.loginTabSignIn && DOM.loginTabSetup) {
            DOM.loginTabSignIn.addEventListener('click', () => {
                DOM.loginTabSignIn.classList.add('active');
                DOM.loginTabSetup.classList.remove('active');
                DOM.loginPaneSignIn.style.display = 'block';
                DOM.loginPaneSetup.style.display = 'none';
            });
            DOM.loginTabSetup.addEventListener('click', () => {
                DOM.loginTabSetup.classList.add('active');
                DOM.loginTabSignIn.classList.remove('active');
                DOM.loginPaneSignIn.style.display = 'none';
                DOM.loginPaneSetup.style.display = 'block';
            });
        }

        // Email / Password Admin Login Form
        if (DOM.loginForm) {
            DOM.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = (DOM.loginEmail.value || '').trim();
                const password = DOM.loginPassword.value;

                if (!email || !password) {
                    showLoginError('Please enter both email and password.');
                    return;
                }

                const submitBtn = DOM.loginForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Verifying Credentials...';
                }

                try {
                    const res = await window.PaloraSupabase.signIn(email, password);
                    if (res.error) {
                        showLoginError(res.error);
                        return;
                    }

                    state.currentUser = res.user;
                    const profile = await window.PaloraSupabase.getProfile(res.user.id);
                    state.currentProfile = profile;
                    state.isAdmin = Boolean(profile && profile.role === 'admin') ||
                                    email === 'palorahomes@gmail.com' ||
                                    (res.user.user_metadata && res.user.user_metadata.role === 'admin');

                    if (!state.isAdmin) {
                        await window.PaloraSupabase.signOut();
                        showLoginError(`Access Denied: Account "${email}" does not have Store Administrator role in Supabase profiles table.`);
                        return;
                    }

                    showToast('Welcome, Store Administrator!', 'success');
                    unlockDashboard();
                } catch (err) {
                    showLoginError(err.message || 'Authentication error.');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Unlock Dashboard →';
                    }
                }
            });
        }

        // First-time Admin Register Helper
        if (DOM.formRegisterAdmin) {
            DOM.formRegisterAdmin.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('setupEmail').value.trim();
                const password = document.getElementById('setupPassword').value;
                const name = document.getElementById('setupName').value.trim();

                try {
                    const res = await window.PaloraSupabase.signUp(email, password, { fullName: name });
                    if (res.error) {
                        showLoginError(res.error);
                        return;
                    }
                    showLoginSuccess(`Account created! Now run the provided SQL in Supabase: UPDATE public.profiles SET role = 'admin' WHERE email = '${email}'; then Sign In.`);
                } catch (err) {
                    showLoginError(err.message);
                }
            });
        }

        // Logout Triggers
        DOM.logoutBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to log out from the Palora Admin Dashboard?')) {
                    await window.PaloraSupabase.signOut();
                    state.currentUser = null;
                    state.currentProfile = null;
                    state.isAdmin = false;
                    lockDashboard();
                    showToast('Logged out successfully.');
                }
            });
        });
    }

    // ====================================================================
    // NAVIGATION ROUTING CONTROLLER
    // ====================================================================
    function setupNavigationRouter() {
        DOM.navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetView = btn.getAttribute('data-view');
                if (!targetView) return;
                switchView(targetView);
            });
        });

        // Mobile sidebar toggle
        if (DOM.sidebarToggle && DOM.sidebar) {
            DOM.sidebarToggle.addEventListener('click', () => {
                DOM.sidebar.classList.toggle('open');
            });
        }

        // Global Refresh button
        if (DOM.btnRefresh) {
            DOM.btnRefresh.addEventListener('click', () => {
                DOM.btnRefresh.style.transform = 'rotate(180deg)';
                DOM.btnRefresh.style.transition = 'transform 0.4s ease';
                setTimeout(() => { DOM.btnRefresh.style.transform = ''; }, 400);
                loadAllData();
                showToast('Refreshing dashboard data...');
            });
        }
    }

    function switchView(viewId) {
        state.activeView = viewId;

        // Update sidebar buttons
        DOM.navButtons.forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-view') === viewId);
        });

        // Update visible view pane
        document.querySelectorAll('.dashboard-view-pane').forEach(p => {
            p.classList.remove('active');
        });
        const activePane = document.getElementById(`view-${viewId}`);
        if (activePane) activePane.classList.add('active');

        // Update Top Navigation Titles
        const viewMeta = {
            'overview': { title: 'Dashboard Overview', sub: 'Real-time sales, order inquiries, product inventory, and customer metrics' },
            'products': { title: 'Products Management', sub: 'Manage live handcrafted catalog, prices, stock levels, and category availability' },
            'orders': { title: 'Customer Orders & Inquiries', sub: 'Review customer inquiries, update fulfillment status, and generate PDF sheets' },
            'cart': { title: 'Customer Cart Tracking', sub: 'Real-time live customer and guest shopping cart activity synchronized via Supabase' },
            'customers': { title: 'Customer Directory', sub: 'Registered customer profiles and lifetime order inquiry histories' },
            'settings': { title: 'Settings & Cloud Health', sub: 'Supabase cloud database connection diagnostics, security, and notification settings' }
        };

        if (viewMeta[viewId]) {
            if (DOM.topTitle) DOM.topTitle.textContent = viewMeta[viewId].title;
            if (DOM.topSub) DOM.topSub.textContent = viewMeta[viewId].sub;
        }

        // Close mobile sidebar if open
        if (DOM.sidebar) DOM.sidebar.classList.remove('open');

        // Render target view data
        renderActiveView();
    }

    function renderActiveView() {
        switch (state.activeView) {
            case 'overview':
                renderOverviewKPIs();
                renderOverviewRecentLists();
                break;
            case 'products':
                renderProductsTable();
                break;
            case 'orders':
                renderOrdersTable();
                break;
            case 'cart':
                renderCartActivityTable();
                break;
            case 'customers':
                renderCustomersTable();
                break;
            case 'settings':
                renderSettingsView();
                break;
        }
    }

    // ====================================================================
    // DATA LOADER & METRICS ENGINE
    // ====================================================================
    async function loadAllData() {
        await Promise.allSettled([
            loadProductsData(),
            loadOrdersData(),
            loadCartActivityData(),
            loadCustomersData()
        ]);

        renderOverviewKPIs();
        renderOverviewRecentLists();
        renderActiveView();
    }

    async function loadProductsData() {
        try {
            const list = await window.PaloraSupabase.adminFetchAllProducts();
            state.products = Array.isArray(list) ? list : [];
        } catch (e) {
            console.error('PaloraAdmin: loadProductsData error', e);
        }
    }

    async function loadOrdersData() {
        try {
            const list = await window.PaloraSupabase.adminFetchAllOrders();
            state.orders = Array.isArray(list) ? list : [];
        } catch (e) {
            console.error('PaloraAdmin: loadOrdersData error', e);
        }
    }

    async function loadCartActivityData() {
        try {
            const list = await window.PaloraSupabase.adminFetchCartActivity();
            state.cartActivity = Array.isArray(list) ? list : [];
        } catch (e) {
            console.error('PaloraAdmin: loadCartActivityData error', e);
        }
    }

    async function loadCustomersData() {
        try {
            const list = await window.PaloraSupabase.adminFetchCustomers();
            state.customers = Array.isArray(list) ? list : [];
        } catch (e) {
            console.error('PaloraAdmin: loadCustomersData error', e);
        }
    }

    // ====================================================================
    // 1. OVERVIEW & KPI METRICS RENDERER
    // ====================================================================
    function renderOverviewKPIs() {
        const totalProducts = state.products.length;
        const totalOrders = state.orders.length;

        let pendingCount = 0;
        let completedCount = 0;
        let totalSales = 0;

        state.orders.forEach(ord => {
            const st = (ord.status || '').toLowerCase().trim();
            if (st === 'pending confirmation' || st === 'pending') {
                pendingCount++;
            } else if (st === 'delivered' || st === 'confirmed') {
                completedCount++;
            }
            if (typeof ord.subtotal === 'number' && !isNaN(ord.subtotal)) {
                totalSales += ord.subtotal;
            }
        });

        const totalCustomers = state.customers.length;

        if (DOM.kpiProducts) DOM.kpiProducts.textContent = totalProducts;
        if (DOM.kpiOrders) DOM.kpiOrders.textContent = totalOrders;
        if (DOM.kpiPending) DOM.kpiPending.textContent = pendingCount;
        if (DOM.kpiCompleted) DOM.kpiCompleted.textContent = completedCount;
        if (DOM.kpiCustomers) DOM.kpiCustomers.textContent = totalCustomers;
        if (DOM.kpiSales) DOM.kpiSales.textContent = `₹${totalSales.toLocaleString('en-IN')}`;

        // Update badge counts on sidebar
        const badgeOrders = document.getElementById('badgeSidebarOrders');
        if (badgeOrders) badgeOrders.textContent = pendingCount > 0 ? pendingCount : totalOrders;
        const badgeCart = document.getElementById('badgeSidebarCart');
        if (badgeCart) badgeCart.textContent = state.cartActivity.length;
    }

    function renderOverviewRecentLists() {
        // 1. Recent Orders Table
        if (DOM.overviewRecentOrders) {
            const recent = state.orders.slice(0, 5);
            if (recent.length === 0) {
                DOM.overviewRecentOrders.innerHTML = `<tr><td colspan="5" class="table-empty-row"><span class="table-empty-icon">📦</span>No customer order inquiries yet.</td></tr>`;
            } else {
                DOM.overviewRecentOrders.innerHTML = recent.map(o => `
                    <tr>
                        <td><strong>#${escapeHtml(o.order_id)}</strong><br><span style="font-size: 0.72rem; color: #888;">${escapeHtml(o.formatted_date || o.created_at)}</span></td>
                        <td>${escapeHtml(o.customer_name)}<br><span style="font-size: 0.72rem; color: #888;">${escapeHtml(o.customer_mobile)}</span></td>
                        <td><strong>${typeof o.subtotal === 'number' ? `₹${o.subtotal.toLocaleString('en-IN')}` : 'Inquiry Quote'}</strong></td>
                        <td><span class="badge-status ${getOrderStatusSlug(o.status)}">${escapeHtml(o.status)}</span></td>
                        <td><button type="button" class="btn-table-action" onclick="window.PaloraAdmin.openOrderDetails('${escapeHtml(o.order_id)}')">View →</button></td>
                    </tr>
                `).join('');
            }
        }

        // 2. Recent Live Carts Table
        if (DOM.overviewRecentCarts) {
            const recentCarts = state.cartActivity.slice(0, 5);
            if (recentCarts.length === 0) {
                DOM.overviewRecentCarts.innerHTML = `<tr><td colspan="4" class="table-empty-row"><span class="table-empty-icon">🛒</span>No live shopping carts at the moment.</td></tr>`;
            } else {
                DOM.overviewRecentCarts.innerHTML = recentCarts.map(c => `
                    <tr>
                        <td><strong>${escapeHtml(c.customer_name || c.session_id.substring(0, 14) + '...')}</strong><br><span style="font-size: 0.72rem; color: #888;">${getRelativeTimeString(c.last_updated)}</span></td>
                        <td>${c.total_items} piece${c.total_items !== 1 ? 's' : ''}</td>
                        <td><strong>${c.cart_total > 0 ? `₹${c.cart_total.toLocaleString('en-IN')}` : 'Inquiry Quote'}</strong></td>
                        <td><button type="button" class="btn-table-action" onclick="window.PaloraAdmin.inspectCart('${escapeHtml(c.session_id)}')">Inspect</button></td>
                    </tr>
                `).join('');
            }
        }
    }

    function getOrderStatusSlug(status) {
        const s = (status || '').toLowerCase().trim();
        if (s.includes('pending')) return 'pending';
        if (s.includes('confirm')) return 'confirmed';
        if (s.includes('pack') || s.includes('process')) return 'processing';
        if (s.includes('dispatch') || s.includes('ship')) return 'dispatched';
        if (s.includes('deliver')) return 'delivered';
        if (s.includes('cancel')) return 'cancelled';
        return 'pending';
    }

    // ====================================================================
    // 2. PRODUCT MANAGEMENT CONTROLLER
    // ====================================================================
    function renderProductsTable() {
        if (!DOM.productsTableBody) return;

        let filtered = state.products.slice();

        // Search filter
        if (state.productFilter.search) {
            const q = state.productFilter.search.toLowerCase();
            filtered = filtered.filter(p => {
                const title = (p.title || '').toLowerCase();
                const sub = (p.subtitle || '').toLowerCase();
                const cat = (p.category_name || p.category || '').toLowerCase();
                const id = (p.id || '').toLowerCase();
                return title.includes(q) || sub.includes(q) || cat.includes(q) || id.includes(q);
            });
        }

        // Category filter
        if (state.productFilter.category && state.productFilter.category !== 'all') {
            filtered = filtered.filter(p => p.category_id === state.productFilter.category || p.category === state.productFilter.category);
        }

        if (filtered.length === 0) {
            DOM.productsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="table-empty-row">
                        <span class="table-empty-icon">🛍️</span>
                        <p>No products match your search or filter.</p>
                        <button type="button" class="btn-primary-admin" style="margin: 12px auto 0;" onclick="window.PaloraAdmin.openAddProductModal()">
                            ➕ Add First Product
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        DOM.productsTableBody.innerHTML = filtered.map(p => {
            const isAvail = p.is_available !== false;
            const priceDisplay = (typeof p.price === 'number' && !isNaN(p.price) && p.price > 0)
                ? `₹${p.price.toLocaleString('en-IN')}`
                : '<span style="color: #92400E; font-size: 0.74rem; font-weight: 600;">Inquiry Quote</span>';
            const stockQty = typeof p.stock_quantity === 'number' ? p.stock_quantity : (typeof p.stockQuantity === 'number' ? p.stockQuantity : 15);
            const imageSrc = p.image_url || p.image || 'assets/images/deer-floating-shelves.jpg';

            return `
                <tr data-product-id="${escapeHtml(p.id)}">
                    <td>
                        <div class="table-product-cell">
                            <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(p.title)}" class="table-product-thumb" onerror="this.src='assets/images/deer-floating-shelves.jpg'">
                            <div class="table-product-info">
                                <span class="table-product-title">${escapeHtml(p.title)}</span>
                                <span class="table-product-sub">${escapeHtml(p.subtitle || p.specs || '')}</span>
                                <span style="font-size: 0.7rem; color: #999; font-family: monospace;">ID: ${escapeHtml(p.id)}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span style="font-weight: 600; font-size: 0.8rem; background: #FAF5ED; padding: 3px 8px; border-radius: 6px; border: 1px solid #EFEAE3;">
                            ${escapeHtml(p.category_name || p.category || 'Handcrafted')}
                        </span>
                    </td>
                    <td><strong style="color: var(--admin-wood-dark); font-size: 0.92rem;">${priceDisplay}</strong></td>
                    <td>
                        <span style="font-weight: 700; ${stockQty <= 3 ? 'color: #DC2626;' : 'color: #166534;'}">
                            ${stockQty} pcs
                        </span>
                    </td>
                    <td>
                        <button type="button" class="btn-table-action ${isAvail ? 'badge-avail-true' : 'badge-avail-false'}" onclick="window.PaloraAdmin.toggleProductAvailability('${escapeHtml(p.id)}')">
                            ${isAvail ? '● Active' : '○ Hidden'}
                        </button>
                    </td>
                    <td>
                        <div class="action-btn-group">
                            <button type="button" class="btn-table-action" onclick="window.PaloraAdmin.openEditProductModal('${escapeHtml(p.id)}')">
                                ✏️ Edit
                            </button>
                            <button type="button" class="btn-table-action delete" onclick="window.PaloraAdmin.deleteProduct('${escapeHtml(p.id)}')">
                                🗑️ Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function setupProductListeners() {
        if (DOM.productSearchInput) {
            DOM.productSearchInput.addEventListener('input', (e) => {
                state.productFilter.search = e.target.value.trim();
                renderProductsTable();
            });
        }

        if (DOM.productCategorySelect) {
            DOM.productCategorySelect.addEventListener('change', (e) => {
                state.productFilter.category = e.target.value;
                renderProductsTable();
            });
        }

        if (DOM.btnOpenAddProduct) {
            DOM.btnOpenAddProduct.addEventListener('click', () => {
                openAddProductModal();
            });
        }

        // One-Click Seed Catalog Button
        if (DOM.btnSeedCatalog) {
            DOM.btnSeedCatalog.addEventListener('click', async () => {
                if (confirm('Sync all 23 signature handcrafted products from config.js into Supabase Cloud database? Duplicate products will NOT be created.')) {
                    DOM.btnSeedCatalog.disabled = true;
                    DOM.btnSeedCatalog.textContent = '⏳ Syncing Catalog...';
                    const res = await window.PaloraSupabase.adminSeedDefaultProducts();
                    DOM.btnSeedCatalog.disabled = false;
                    DOM.btnSeedCatalog.textContent = '🔄 Sync Catalog to Cloud';

                    if (res.success) {
                        showToast(`✓ Successfully synced ${res.count} products into Supabase database!`, 'success');
                        await loadProductsData();
                        renderProductsTable();
                        renderOverviewKPIs();
                    } else {
                        showToast(`Error syncing products: ${res.error}`, 'error');
                    }
                }
            });
        }

        // Product Form Submit Handler (Add / Edit)
        if (DOM.productForm) {
            DOM.productForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const idInput = document.getElementById('editProductId');
                const titleInput = document.getElementById('editProductTitle');
                const categoryInput = document.getElementById('editProductCategory');
                const priceInput = document.getElementById('editProductPrice');
                const stockInput = document.getElementById('editProductStock');
                const subtitleInput = document.getElementById('editProductSubtitle');
                const specsInput = document.getElementById('editProductSpecs');
                const imageInput = document.getElementById('editProductImage');
                const descInput = document.getElementById('editProductDesc');
                const availInput = document.getElementById('editProductAvailable');

                const isNew = !idInput.value;
                const id = isNew ? generateProductId(titleInput.value, categoryInput.value) : idInput.value;

                // Handle file upload if attached
                let finalImageUrl = imageInput.value.trim();
                if (DOM.productImageFileInput && DOM.productImageFileInput.files.length > 0) {
                    const file = DOM.productImageFileInput.files[0];
                    showToast('Uploading product image to Supabase Storage...', 'success');
                    const uploadRes = await window.PaloraSupabase.adminUploadProductImage(file);
                    if (uploadRes.publicUrl) {
                        finalImageUrl = uploadRes.publicUrl;
                    } else {
                        showToast(`Image upload warning: ${uploadRes.error}`, 'error');
                    }
                }

                if (!finalImageUrl) {
                    finalImageUrl = 'assets/images/deer-floating-shelves.jpg';
                }

                const categoryNames = {
                    'wall-decor': 'Wall Decor',
                    'wall-clock': 'Wall Clock',
                    'night-lamp': 'Night Lamp',
                    'wall-hanging': 'Wall Hanging',
                    'car-dashboard': 'Car Dashboard Decore',
                    'key-holder': 'Key Holder'
                };

                const productRecord = {
                    id: id,
                    category_id: categoryInput.value,
                    category_name: categoryNames[categoryInput.value] || 'Handcrafted Decor',
                    title: titleInput.value.trim(),
                    subtitle: subtitleInput.value.trim(),
                    specs: specsInput.value.trim(),
                    description: descInput.value.trim(),
                    price: priceInput.value ? parseFloat(priceInput.value) : null,
                    stock_quantity: parseInt(stockInput.value, 10) || 10,
                    is_available: availInput.checked,
                    status: availInput.checked ? 'Available for Order' : 'Out of Stock',
                    image_url: finalImageUrl,
                    highlights: specsInput.value ? specsInput.value.split('•').map(s => s.trim()) : []
                };

                const saveBtn = DOM.productForm.querySelector('button[type="submit"]');
                if (saveBtn) saveBtn.disabled = true;

                try {
                    const res = await window.PaloraSupabase.adminSaveProduct(productRecord);
                    if (res.success) {
                        showToast(`Product "${productRecord.title}" saved successfully!`, 'success');
                        closeProductModal();
                        await loadProductsData();
                        renderProductsTable();
                        renderOverviewKPIs();
                    } else {
                        showToast(`Failed to save product: ${res.error}`, 'error');
                    }
                } catch (err) {
                    showToast(`Error: ${err.message}`, 'error');
                } finally {
                    if (saveBtn) saveBtn.disabled = false;
                }
            });
        }
    }

    function generateProductId(title, category) {
        const clean = (title || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return `${category || 'decor'}-${clean.substring(0, 30)}`;
    }

    function openAddProductModal() {
        if (!DOM.productModal) return;
        DOM.productForm.reset();
        document.getElementById('editProductId').value = '';
        document.getElementById('editProductAvailable').checked = true;
        if (DOM.productModalTitle) DOM.productModalTitle.textContent = 'Add New Handcrafted Product';
        DOM.productModal.classList.add('open');
    }

    function openEditProductModal(productId) {
        const product = state.products.find(p => p.id === productId);
        if (!product || !DOM.productModal) return;

        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductTitle').value = product.title || '';
        document.getElementById('editProductCategory').value = product.category_id || product.category || 'wall-decor';
        document.getElementById('editProductPrice').value = (typeof product.price === 'number') ? product.price : '';
        document.getElementById('editProductStock').value = typeof product.stock_quantity === 'number' ? product.stock_quantity : 10;
        document.getElementById('editProductSubtitle').value = product.subtitle || '';
        document.getElementById('editProductSpecs').value = product.specs || '';
        document.getElementById('editProductImage').value = product.image_url || product.image || '';
        document.getElementById('editProductDesc').value = product.description || '';
        document.getElementById('editProductAvailable').checked = product.is_available !== false;

        if (DOM.productModalTitle) DOM.productModalTitle.textContent = `Edit Product: ${product.title}`;
        DOM.productModal.classList.add('open');
    }

    function closeProductModal() {
        if (DOM.productModal) DOM.productModal.classList.remove('open');
    }

    async function toggleProductAvailability(productId) {
        const product = state.products.find(p => p.id === productId);
        if (!product) return;
        const newAvail = !(product.is_available !== false);

        const updated = Object.assign({}, product, {
            is_available: newAvail,
            status: newAvail ? 'Available for Order' : 'Out of Stock'
        });

        const res = await window.PaloraSupabase.adminSaveProduct(updated);
        if (res.success) {
            showToast(`"${product.title}" is now ${newAvail ? 'Active on Store' : 'Hidden from Store'}`);
            await loadProductsData();
            renderProductsTable();
        } else {
            showToast(`Update error: ${res.error}`, 'error');
        }
    }

    async function deleteProduct(productId) {
        const product = state.products.find(p => p.id === productId);
        const title = product ? product.title : productId;

        if (confirm(`Are you sure you want to delete "${title}"? This will remove it from the catalog permanently.`)) {
            const res = await window.PaloraSupabase.adminDeleteProduct(productId);
            if (res.success) {
                showToast(`Product deleted successfully.`);
                await loadProductsData();
                renderProductsTable();
                renderOverviewKPIs();
            } else {
                showToast(`Failed to delete product: ${res.error}`, 'error');
            }
        }
    }

    // ====================================================================
    // 3. ORDER MANAGEMENT CONTROLLER
    // ====================================================================
    function renderOrdersTable() {
        if (!DOM.ordersTableBody) return;

        let filtered = state.orders.slice();

        // Search filter
        if (state.orderFilter.search) {
            const q = state.orderFilter.search.toLowerCase();
            filtered = filtered.filter(o => {
                const oid = (o.order_id || '').toLowerCase();
                const name = (o.customer_name || '').toLowerCase();
                const mobile = (o.customer_mobile || '').toLowerCase();
                const city = (o.city || '').toLowerCase();
                return oid.includes(q) || name.includes(q) || mobile.includes(q) || city.includes(q);
            });
        }

        // Status filter
        if (state.orderFilter.status && state.orderFilter.status !== 'all') {
            filtered = filtered.filter(o => {
                return (o.status || '').toLowerCase().trim() === state.orderFilter.status.toLowerCase().trim();
            });
        }

        if (filtered.length === 0) {
            DOM.ordersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty-row">
                        <span class="table-empty-icon">📦</span>
                        <p>No customer orders match the current filter.</p>
                    </td>
                </tr>
            `;
            return;
        }

        DOM.ordersTableBody.innerHTML = filtered.map(o => {
            const items = Array.isArray(o.items) ? o.items : [];
            const itemsSummary = items.map(it => `${it.quantity || 1}x ${it.title}`).join(', ') || 'Palora Decor Item';
            const priceDisplay = (typeof o.subtotal === 'number' && !isNaN(o.subtotal) && o.subtotal > 0)
                ? `₹${o.subtotal.toLocaleString('en-IN')}`
                : '<span style="color: #92400E; font-size: 0.74rem; font-weight: 600;">Inquiry Quote</span>';

            return `
                <tr>
                    <td>
                        <strong>#${escapeHtml(o.order_id)}</strong><br>
                        <span style="font-size: 0.74rem; color: #777;">${escapeHtml(o.formatted_date || o.created_at)}</span>
                    </td>
                    <td>
                        <strong>${escapeHtml(o.customer_name)}</strong><br>
                        <span style="font-size: 0.76rem; color: #555;">📞 ${escapeHtml(o.customer_mobile)}</span><br>
                        <span style="font-size: 0.72rem; color: #888;">📍 ${escapeHtml(o.city || '')}${o.state ? ', ' + escapeHtml(o.state) : ''}</span>
                    </td>
                    <td style="max-width: 240px;">
                        <span style="font-size: 0.82rem; color: #333; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${escapeHtml(itemsSummary)}">
                            ${escapeHtml(itemsSummary)}
                        </span>
                        <span style="font-size: 0.72rem; color: var(--admin-gold-dark); font-weight: 700;">
                            ${o.total_pieces || items.length} Pieces Total
                        </span>
                    </td>
                    <td><strong style="font-size: 0.95rem; color: var(--admin-wood-dark);">${priceDisplay}</strong></td>
                    <td>
                        <span class="badge-status ${getOrderStatusSlug(o.status)}">
                            ${escapeHtml(o.status)}
                        </span>
                    </td>
                    <td>
                        <div class="action-btn-group">
                            <button type="button" class="btn-table-action" onclick="window.PaloraAdmin.openOrderDetails('${escapeHtml(o.order_id)}')">
                                🔍 Details
                            </button>
                            <button type="button" class="btn-table-action" onclick="window.PaloraAdmin.downloadOrderPDF('${escapeHtml(o.order_id)}')">
                                📄 PDF
                            </button>
                            <button type="button" class="btn-table-action delete" onclick="window.PaloraAdmin.deleteOrder('${escapeHtml(o.order_id)}')">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function setupOrderListeners() {
        if (DOM.orderSearchInput) {
            DOM.orderSearchInput.addEventListener('input', (e) => {
                state.orderFilter.search = e.target.value.trim();
                renderOrdersTable();
            });
        }

        if (DOM.orderStatusSelect) {
            DOM.orderStatusSelect.addEventListener('change', (e) => {
                state.orderFilter.status = e.target.value;
                renderOrdersTable();
            });
        }

        // Export Orders CSV
        if (DOM.btnExportOrdersCSV) {
            DOM.btnExportOrdersCSV.addEventListener('click', () => {
                exportOrdersToCSV();
            });
        }

        // Backup Orders JSON
        if (DOM.btnBackupOrdersJSON) {
            DOM.btnBackupOrdersJSON.addEventListener('click', () => {
                backupOrdersToJSON();
            });
        }

        // Save order status & admin notes from Modal
        if (DOM.btnSaveOrderStatus) {
            DOM.btnSaveOrderStatus.addEventListener('click', async () => {
                const orderId = DOM.orderModal.getAttribute('data-order-id');
                const newStatus = DOM.orderStatusDropdown.value;
                const notes = DOM.orderAdminNotes.value.trim();

                DOM.btnSaveOrderStatus.disabled = true;
                DOM.btnSaveOrderStatus.textContent = 'Updating...';

                try {
                    const res = await window.PaloraSupabase.adminUpdateOrderStatus(orderId, newStatus, notes);
                    if (res.success) {
                        showToast(`Order #${orderId} updated to "${newStatus}"!`, 'success');
                        closeOrderModal();
                        await loadOrdersData();
                        renderOrdersTable();
                        renderOverviewKPIs();
                    } else {
                        showToast(`Failed to update status: ${res.error}`, 'error');
                    }
                } catch (err) {
                    showToast(`Error: ${err.message}`, 'error');
                } finally {
                    DOM.btnSaveOrderStatus.disabled = false;
                    DOM.btnSaveOrderStatus.textContent = 'Save Status Update';
                }
            });
        }
    }

    function openOrderDetails(orderId) {
        const order = state.orders.find(o => o.order_id === orderId);
        if (!order || !DOM.orderModal) return;

        DOM.orderModal.setAttribute('data-order-id', order.order_id);
        if (DOM.orderModalTitle) DOM.orderModalTitle.textContent = `Order Inquiry #${order.order_id}`;
        if (DOM.orderModalDate) DOM.orderModalDate.textContent = `Placed on: ${order.formatted_date || order.created_at}`;

        if (DOM.orderStatusDropdown) {
            DOM.orderStatusDropdown.value = order.status || 'Pending Confirmation';
        }
        if (DOM.orderAdminNotes) {
            DOM.orderAdminNotes.value = order.admin_notes || '';
        }

        const items = Array.isArray(order.items) ? order.items : [];
        let itemsHtml = items.map((it, idx) => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #EFEAE3;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: 700; color: var(--admin-gold-dark);">${idx + 1}.</span>
                    <div>
                        <strong>${escapeHtml(it.title)}</strong>
                        <div style="font-size: 0.74rem; color: #777;">${escapeHtml(it.specs || it.category || '')}</div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="font-weight: 600;">Qty: ${it.quantity || 1}</span>
                    <div style="font-weight: 700; color: var(--admin-wood-dark); font-size: 0.88rem;">
                        ${typeof it.price === 'number' ? `₹${(it.price * (it.quantity || 1)).toLocaleString('en-IN')}` : 'Inquiry Quote'}
                    </div>
                </div>
            </div>
        `).join('');

        if (DOM.orderModalBody) {
            DOM.orderModalBody.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; background: #FAF7F2; padding: 14px; border-radius: 8px; border: 1px solid #E8DFD3;">
                    <div>
                        <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #888;">Customer Details</span>
                        <div style="font-weight: 700; font-size: 0.95rem; margin-top: 2px;">${escapeHtml(order.customer_name)}</div>
                        <div style="font-size: 0.82rem; color: #555;">📞 ${escapeHtml(order.customer_mobile)}</div>
                        ${order.customer_email ? `<div style="font-size: 0.82rem; color: #555;">✉️ ${escapeHtml(order.customer_email)}</div>` : ''}
                    </div>
                    <div>
                        <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #888;">Delivery Address</span>
                        <div style="font-size: 0.85rem; line-height: 1.3; margin-top: 2px;">${escapeHtml(order.delivery_address || 'Address on file')}</div>
                        <div style="font-size: 0.8rem; color: #666;">${escapeHtml(order.city || '')}${order.state ? ', ' + escapeHtml(order.state) : ''} - ${escapeHtml(order.pincode || '')}</div>
                    </div>
                </div>

                ${order.customer_notes ? `
                    <div style="margin-bottom: 16px; padding: 10px 14px; background: #FFF8E1; border-left: 3px solid var(--admin-gold); border-radius: 4px; font-size: 0.82rem;">
                        <strong>Customer Special Instructions:</strong> ${escapeHtml(order.customer_notes)}
                    </div>
                ` : ''}

                <div style="margin-bottom: 16px;">
                    <div style="font-weight: 700; font-size: 0.84rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; color: var(--admin-wood-dark);">
                        Ordered Pieces (${order.total_pieces || items.length} Total)
                    </div>
                    ${itemsHtml}
                    <div style="display: flex; justify-content: space-between; padding-top: 10px; font-size: 1rem; font-weight: 800;">
                        <span>Estimated Subtotal:</span>
                        <span style="color: var(--admin-wood-dark);">${typeof order.subtotal === 'number' ? `₹${order.subtotal.toLocaleString('en-IN')}` : 'Inquiry Quote'}</span>
                    </div>
                </div>
            `;
        }

        // Set action buttons in modal
        if (DOM.btnChatOrderWhatsApp) {
            DOM.btnChatOrderWhatsApp.onclick = () => {
                const phone = String(order.customer_mobile || '').replace(/[^0-9]/g, '');
                const formattedPhone = phone.startsWith('91') ? phone : ('91' + phone);
                const msg = `Hello ${order.customer_name}, regards from Palora Homes regarding your order inquiry #${order.order_id}.`;
                window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, '_blank');
            };
        }

        if (DOM.btnDownloadOrderPDF) {
            DOM.btnDownloadOrderPDF.onclick = () => {
                downloadOrderPDF(order.order_id);
            };
        }

        if (DOM.btnDeleteOrder) {
            DOM.btnDeleteOrder.onclick = () => {
                deleteOrder(order.order_id);
            };
        }

        DOM.orderModal.classList.add('open');
    }

    function closeOrderModal() {
        if (DOM.orderModal) DOM.orderModal.classList.remove('open');
    }

    function downloadOrderPDF(orderId) {
        const order = state.orders.find(o => o.order_id === orderId);
        if (!order) return;
        if (window.PaloraPDFOrder && typeof window.PaloraPDFOrder.generateOrderPDF === 'function') {
            window.PaloraPDFOrder.generateOrderPDF(order);
            showToast(`Generating PDF sheet for #${order.order_id}...`);
        } else {
            showToast('PDF generator library not loaded.', 'error');
        }
    }

    async function deleteOrder(orderId) {
        if (confirm(`Are you sure you want to permanently delete order inquiry #${orderId}?`)) {
            const res = await window.PaloraSupabase.adminDeleteOrder(orderId);
            if (res.success) {
                showToast(`Order #${orderId} deleted.`);
                closeOrderModal();
                await loadOrdersData();
                renderOrdersTable();
                renderOverviewKPIs();
            } else {
                showToast(`Failed to delete order: ${res.error}`, 'error');
            }
        }
    }

    function exportOrdersToCSV() {
        if (state.orders.length === 0) {
            showToast('No orders available to export.');
            return;
        }

        const headers = ['Order ID', 'Date', 'Status', 'Customer Name', 'Mobile', 'Email', 'Delivery Address', 'City', 'State', 'Pincode', 'Items Count', 'Subtotal'];
        const rows = state.orders.map(o => [
            `"${o.order_id}"`,
            `"${o.formatted_date || o.created_at}"`,
            `"${o.status}"`,
            `"${(o.customer_name || '').replace(/"/g, '""')}"`,
            `"${o.customer_mobile}"`,
            `"${o.customer_email || ''}"`,
            `"${(o.delivery_address || '').replace(/"/g, '""')}"`,
            `"${o.city || ''}"`,
            `"${o.state || ''}"`,
            `"${o.pincode || ''}"`,
            o.total_pieces || (o.items || []).length,
            o.subtotal || ''
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `palora_orders_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Exported orders to CSV file.');
    }

    function backupOrdersToJSON() {
        if (state.orders.length === 0) {
            showToast('No orders available to backup.');
            return;
        }

        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.orders, null, 2));
        const dl = document.createElement('a');
        dl.setAttribute('href', dataStr);
        dl.setAttribute('download', `palora_orders_backup_${Date.now()}.json`);
        document.body.appendChild(dl);
        dl.click();
        document.body.removeChild(dl);
        showToast('Orders backup downloaded in JSON.');
    }

    // ====================================================================
    // 4. CUSTOMER CART TRACKING CONTROLLER
    // ====================================================================
    function renderCartActivityTable() {
        if (!DOM.cartActivityTableBody) return;

        let filtered = state.cartActivity.slice();

        if (state.cartFilter.search) {
            const q = state.cartFilter.search.toLowerCase();
            filtered = filtered.filter(c => {
                const sid = (c.session_id || '').toLowerCase();
                const name = (c.customer_name || '').toLowerCase();
                const phone = (c.customer_phone || '').toLowerCase();
                return sid.includes(q) || name.includes(q) || phone.includes(q);
            });
        }

        if (filtered.length === 0) {
            DOM.cartActivityTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty-row">
                        <span class="table-empty-icon">🛒</span>
                        <p>No active customer shopping carts recorded yet.</p>
                        <span style="font-size: 0.74rem; color: #888;">When storefront visitors add items to cart, their live carts appear here.</span>
                    </td>
                </tr>
            `;
            return;
        }

        DOM.cartActivityTableBody.innerHTML = filtered.map(c => {
            const items = Array.isArray(c.items) ? c.items : [];
            const isGuest = !c.customer_name;
            const customerTitle = c.customer_name ? escapeHtml(c.customer_name) : `Anonymous Guest (${escapeHtml(c.session_id.substring(0, 12))}...)`;
            const phoneDisplay = c.customer_phone ? `📞 ${escapeHtml(c.customer_phone)}` : '<span style="color: #999; font-style: italic;">Contact not provided</span>';
            const thumbsHtml = items.slice(0, 3).map(it => `
                <img src="${escapeHtml(it.image || 'assets/images/deer-floating-shelves.jpg')}" alt="${escapeHtml(it.title)}" style="width: 28px; height: 28px; border-radius: 4px; object-fit: cover; border: 1px solid #ddd;" title="${escapeHtml(it.title)}">
            `).join('');

            return `
                <tr>
                    <td>
                        <strong style="color: var(--admin-wood-dark);">${customerTitle}</strong><br>
                        <span style="font-size: 0.7rem; font-family: monospace; color: #888;">Session: ${escapeHtml(c.session_id)}</span>
                    </td>
                    <td><span style="font-size: 0.8rem;">${phoneDisplay}</span></td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${thumbsHtml}
                            <span style="font-weight: 700; font-size: 0.82rem; margin-left: 4px;">${c.total_items} item${c.total_items !== 1 ? 's' : ''}</span>
                        </div>
                    </td>
                    <td><strong>${c.cart_total > 0 ? `₹${c.cart_total.toLocaleString('en-IN')}` : 'Inquiry Quote'}</strong></td>
                    <td>
                        <span style="font-size: 0.78rem; font-weight: 600; color: #444;">${getRelativeTimeString(c.last_updated)}</span><br>
                        <span style="font-size: 0.7rem; color: #888;">${new Date(c.last_updated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td>
                        <div class="action-btn-group">
                            <button type="button" class="btn-table-action" onclick="window.PaloraAdmin.inspectCart('${escapeHtml(c.session_id)}')">
                                🔍 Inspect Items
                            </button>
                            <button type="button" class="btn-table-action delete" onclick="window.PaloraAdmin.deleteCartActivity('${escapeHtml(c.session_id)}')">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function setupCartActivityListeners() {
        if (DOM.cartSearchInput) {
            DOM.cartSearchInput.addEventListener('input', (e) => {
                state.cartFilter.search = e.target.value.trim();
                renderCartActivityTable();
            });
        }

        if (DOM.btnRefreshCartActivity) {
            DOM.btnRefreshCartActivity.addEventListener('click', async () => {
                await loadCartActivityData();
                renderCartActivityTable();
                showToast('Cart activity refreshed.');
            });
        }
    }

    function inspectCart(sessionId) {
        const cart = state.cartActivity.find(c => c.session_id === sessionId);
        if (!cart || !DOM.cartModal) return;

        const items = Array.isArray(cart.items) ? cart.items : [];
        const itemsHtml = items.map((it, idx) => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #EFEAE3;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${escapeHtml(it.image || 'assets/images/deer-floating-shelves.jpg')}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover;">
                    <div>
                        <strong style="font-size: 0.88rem;">${escapeHtml(it.title)}</strong>
                        <div style="font-size: 0.74rem; color: #777;">${escapeHtml(it.specs || it.category || '')}</div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="font-weight: 600; font-size: 0.82rem;">Qty: ${it.quantity || 1}</span>
                    <div style="font-weight: 700; color: var(--admin-wood-dark);">
                        ${typeof it.price === 'number' ? `₹${(it.price * (it.quantity || 1)).toLocaleString('en-IN')}` : 'Inquiry Quote'}
                    </div>
                </div>
            </div>
        `).join('');

        if (DOM.cartModalBody) {
            DOM.cartModalBody.innerHTML = `
                <div style="margin-bottom: 14px; padding: 12px; background: #FAF7F2; border-radius: 8px; border: 1px solid #E8DFD3;">
                    <strong style="font-size: 0.95rem;">${escapeHtml(cart.customer_name || 'Anonymous Guest')}</strong>
                    <div style="font-size: 0.76rem; font-family: monospace; color: #888;">Session: ${escapeHtml(cart.session_id)}</div>
                    ${cart.customer_phone ? `<div style="font-size: 0.8rem; margin-top: 4px;">📞 ${escapeHtml(cart.customer_phone)}</div>` : ''}
                    <div style="font-size: 0.74rem; color: #777; margin-top: 4px;">Last Activity: ${new Date(cart.last_updated).toLocaleString('en-IN')} (${getRelativeTimeString(cart.last_updated)})</div>
                </div>

                <div style="margin-bottom: 12px; font-weight: 700; font-size: 0.82rem; text-transform: uppercase;">
                    Cart Contents (${cart.total_items} Pieces)
                </div>
                ${itemsHtml}
                <div style="display: flex; justify-content: space-between; padding-top: 12px; font-size: 1rem; font-weight: 800;">
                    <span>Total Estimated Value:</span>
                    <span style="color: var(--admin-wood-dark);">${cart.cart_total > 0 ? `₹${cart.cart_total.toLocaleString('en-IN')}` : 'Inquiry Quote'}</span>
                </div>
            `;
        }

        DOM.cartModal.classList.add('open');
    }

    function closeCartModal() {
        if (DOM.cartModal) DOM.cartModal.classList.remove('open');
    }

    async function deleteCartActivity(sessionId) {
        if (confirm('Clear this cart session record?')) {
            const res = await window.PaloraSupabase.adminDeleteCartActivity(sessionId);
            if (res.success) {
                showToast('Cart activity record removed.');
                closeCartModal();
                await loadCartActivityData();
                renderCartActivityTable();
                renderOverviewKPIs();
            } else {
                showToast(`Failed: ${res.error}`, 'error');
            }
        }
    }

    // ====================================================================
    // 5. CUSTOMER DIRECTORY CONTROLLER
    // ====================================================================
    function renderCustomersTable() {
        if (!DOM.customersTableBody) return;

        let filtered = state.customers.slice();

        if (state.customerFilter.search) {
            const q = state.customerFilter.search.toLowerCase();
            filtered = filtered.filter(c => {
                const name = (c.fullName || '').toLowerCase();
                const phone = (c.phone || '').toLowerCase();
                const email = (c.email || '').toLowerCase();
                const city = (c.city || '').toLowerCase();
                return name.includes(q) || phone.includes(q) || email.includes(q) || city.includes(q);
            });
        }

        if (filtered.length === 0) {
            DOM.customersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty-row">
                        <span class="table-empty-icon">👥</span>
                        <p>No customer records found.</p>
                    </td>
                </tr>
            `;
            return;
        }

        DOM.customersTableBody.innerHTML = filtered.map(c => `
            <tr>
                <td>
                    <strong>${escapeHtml(c.fullName || 'Store Customer')}</strong><br>
                    <span style="font-size: 0.72rem; color: #888;">${c.role === 'admin' ? '⭐ Store Administrator' : 'Customer'}</span>
                </td>
                <td>${c.phone ? `📞 ${escapeHtml(c.phone)}` : '<span style="color: #999;">—</span>'}</td>
                <td>${c.email ? `✉️ ${escapeHtml(c.email)}` : '<span style="color: #999;">—</span>'}</td>
                <td>${escapeHtml(c.city || '')}${c.state ? ', ' + escapeHtml(c.state) : (c.address ? escapeHtml(c.address) : '—')}</td>
                <td>
                    <span style="font-weight: 700; background: #FAF5ED; padding: 2px 8px; border-radius: 10px; border: 1px solid #EFEAE3;">
                        ${c.ordersCount || 0} Orders
                    </span>
                </td>
                <td>
                    <strong style="color: var(--admin-wood-dark);">
                        ${c.totalSpent > 0 ? `₹${c.totalSpent.toLocaleString('en-IN')}` : 'Inquiry Quote'}
                    </strong>
                </td>
            </tr>
        `).join('');
    }

    function setupCustomerListeners() {
        if (DOM.customerSearchInput) {
            DOM.customerSearchInput.addEventListener('input', (e) => {
                state.customerFilter.search = e.target.value.trim();
                renderCustomersTable();
            });
        }
    }

    // ====================================================================
    // 6. SETTINGS & CLOUD HEALTH CONTROLLER
    // ====================================================================
    function renderSettingsView() {
        const config = (window.PALORA_CONFIG && window.PALORA_CONFIG.supabase) || {};
        if (DOM.settingSupabaseUrl) DOM.settingSupabaseUrl.textContent = config.url || 'Not configured';
        if (DOM.settingSupabaseKey) {
            const k = config.anonKey || '';
            DOM.settingSupabaseKey.textContent = k ? (k.substring(0, 10) + '...' + k.substring(k.length - 8)) : 'Not configured';
        }
        if (DOM.settingAdminEmail && state.currentUser) {
            DOM.settingAdminEmail.textContent = state.currentUser.email || 'Admin';
        }
        if (DOM.settingAdminRole) {
            DOM.settingAdminRole.textContent = state.isAdmin ? 'Store Administrator (Verified)' : 'Restricted';
        }
    }

    function setupSettingsListeners() {
        if (DOM.btnTestNotif) {
            DOM.btnTestNotif.addEventListener('click', () => {
                if ('Notification' in window) {
                    if (Notification.permission === 'granted') {
                        new Notification('Palora Homes Admin Alert', {
                            body: '🔔 Desktop notifications are working! You will be alerted when new inquiries arrive.',
                            icon: 'assets/images/deer-floating-shelves.jpg'
                        });
                        showToast('Test notification dispatched!');
                    } else {
                        Notification.requestPermission().then(perm => {
                            if (perm === 'granted') {
                                showToast('Desktop notifications permitted!');
                            } else {
                                showToast('Notification permission denied.', 'error');
                            }
                        });
                    }
                } else {
                    showToast('Notifications not supported by this browser.', 'error');
                }
            });
        }
    }

    // ====================================================================
    // MODAL DISMISSAL LISTENERS
    // ====================================================================
    function setupModalDismissListeners() {
        document.querySelectorAll('.admin-modal-backdrop').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('open');
                }
            });
        });

        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = btn.closest('.admin-modal-backdrop');
                if (modal) modal.classList.remove('open');
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.admin-modal-backdrop.open').forEach(m => m.classList.remove('open'));
            }
        });
    }

    // ====================================================================
    // PUBLIC API FOR WINDOW (Event Bindings)
    // ====================================================================
    window.PaloraAdmin = {
        switchView: switchView,
        openAddProductModal: openAddProductModal,
        openEditProductModal: openEditProductModal,
        closeProductModal: closeProductModal,
        toggleProductAvailability: toggleProductAvailability,
        deleteProduct: deleteProduct,
        openOrderDetails: openOrderDetails,
        closeOrderModal: closeOrderModal,
        downloadOrderPDF: downloadOrderPDF,
        deleteOrder: deleteOrder,
        inspectCart: inspectCart,
        closeCartModal: closeCartModal,
        deleteCartActivity: deleteCartActivity
    };

    // Initialize on DOM Ready
    document.addEventListener('DOMContentLoaded', () => {
        cacheDOMElements();
        setupAuthListeners();
        setupNavigationRouter();
        setupProductListeners();
        setupOrderListeners();
        setupCartActivityListeners();
        setupCustomerListeners();
        setupSettingsListeners();
        setupModalDismissListeners();

        // Check authentication state
        checkAuthSession();

        // Auto-refresh data every 60s
        setInterval(() => {
            if (state.isAdmin) {
                loadAllData();
            }
        }, 60000);
    });

})(window, document);
