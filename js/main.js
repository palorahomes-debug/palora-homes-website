/**
 * Palora Homes - Modern Living, Indian Soul
 * Interactive Store Logic & WhatsApp Inquiry Integrations
 * Official WhatsApp: +91 93198 62081
 */

document.addEventListener("DOMContentLoaded", () => {
    // State
    const state = {
        activeFilter: "all",
        bag: [],
        quantities: {},
        products: (window.PALORA_CONFIG && window.PALORA_CONFIG.upcomingCollections) ? window.PALORA_CONFIG.upcomingCollections : []
    };

    // DOM Elements
    const productsGrid = document.getElementById("productsGrid");
    const catalogFilters = document.getElementById("catalogFilters");
    const catalogSubtitle = document.getElementById("catalogSubtitle");
    const categoryButtons = document.querySelectorAll(".category-circle-card");
    const navbar = document.getElementById("navbar");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const navLinks = document.querySelector(".nav-links");
    const searchBtn = document.getElementById("searchBtn");
    const searchModal = document.getElementById("searchModal");
    const closeSearchBtn = document.getElementById("closeSearchBtn");
    const searchInput = document.getElementById("searchInput");
    const searchResultsList = document.getElementById("searchResultsList");
    const cartBtn = document.getElementById("cartBtn");
    const cartDrawer = document.getElementById("cartDrawer");
    const closeCartBtn = document.getElementById("closeCartBtn");
    const cartItemsList = document.getElementById("cartItemsList");
    const bagCount = document.getElementById("bagCount");
    const checkoutWaBtn = document.getElementById("checkoutWaBtn");
    const quickInquiryForm = document.getElementById("quickInquiryForm");
    const toastNotice = document.getElementById("toastNotice");
    const bubbleCloseBtn = document.getElementById("bubbleCloseBtn");
    const waBubble = document.getElementById("waBubble");
    const accountBtn = document.getElementById("accountBtn");

    // Initialize App
    init();

    function init() {
        renderProducts(state.products);
        setupCategoryInteractions();
        setupFilterTabs();
        setupNavigation();
        setupSearchModal();
        setupCartDrawer();
        setupInquiryForm();
        setupFloatingTooltip();
        setupScrollObserver();

        // Connect live cloud products
        if (window.PaloraProducts && typeof window.PaloraProducts.loadProductsFromCloud === 'function') {
            window.PaloraProducts.loadProductsFromCloud();
        }
    }

    // Cloud products live update listener
    window.addEventListener('palora:products-loaded', (e) => {
        if (e.detail && Array.isArray(e.detail.products)) {
            state.products = e.detail.products;
            if (state.activeFilter === 'all') {
                renderProducts(state.products);
            } else {
                renderProducts(state.products.filter(p => p.category === state.activeFilter));
            }
        }
    });

    /**
     * Format WhatsApp Link helper
     */
    function getWhatsAppLink(message) {
        const phone = (window.PALORA_CONFIG && window.PALORA_CONFIG.whatsappNumber) || "919319862081";
        return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    }

    /**
     * Build WhatsApp order message with selected quantity
     */
    function buildWaOrderMessage(item, qty) {
        const qtyPrefix = qty > 1 ? `*${qty}x* ` : "";
        const specsText = item.specs ? ` • ${item.specs}` : "";
        return `Hello Palora Homes, I would like to order ${qtyPrefix}*${item.title}* (Quantity: ${qty}${specsText}). Please confirm availability, shipping timeframe, and payment details.`;
    }

    /**
     * Show notification toast
     */
    function showToast(message) {
        if (!toastNotice) return;
        toastNotice.textContent = message;
        toastNotice.classList.add("visible");
        setTimeout(() => {
            toastNotice.classList.remove("visible");
        }, 3200);
    }

    /**
     * Escape HTML string
     */
    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Render Products Grid
     */
    function renderProducts(items) {
        if (!productsGrid) return;

        if (items.length === 0) {
            productsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px;">
                    <p style="font-size: 1.1rem; color: var(--color-brown-600); margin-bottom: 12px;">No products found in this category.</p>
                    <button class="filter-tab active" onclick="document.querySelector('[data-filter=all]').click()">View All Items</button>
                </div>
            `;
            return;
        }

        productsGrid.innerHTML = items.map(item => {
            const qty = state.quantities[item.id] || 1;
            const isOutOfStock = (typeof item.stockQuantity === 'number' && item.stockQuantity <= 0) || item.status === 'Out of Stock';
            const highlightsHtml = (item.highlights || [])
                .slice(0, 3)
                .map(h => `<span class="highlight-tag">${escapeHtml(h)}</span>`)
                .join("");

            const priceHtml = (typeof item.price === 'number' && item.price > 0)
                ? `<div class="product-price-row">
                       <span class="product-price-val">₹${item.price.toLocaleString('en-IN')}</span>
                       ${item.salePrice ? `<span class="product-price-original">₹${item.salePrice.toLocaleString('en-IN')}</span>` : ''}
                       ${item.stockQuantity <= 3 && item.stockQuantity > 0 ? `<span class="product-stock-tag product-stock-low">Only ${item.stockQuantity} left</span>` : (isOutOfStock ? `<span class="product-stock-tag product-stock-out">Out of Stock</span>` : '')}
                   </div>`
                : '';

            return `
                <article class="product-card" data-id="${item.id}" data-category="${item.category}">
                    <div class="product-image-wrap">
                        <img 
                            src="${item.image}" 
                            alt="${escapeHtml(item.title)}" 
                            class="product-card-img" 
                            loading="lazy"
                        >
                        <span class="product-badge-status ${isOutOfStock ? 'status-cancelled' : ''}">${escapeHtml(isOutOfStock ? "Out of Stock" : (item.status || "Ready to Order"))}</span>
                    </div>

                    <div class="product-info-wrap">
                        <div class="product-category-row">
                            <span class="product-cat-tag">${escapeHtml(item.categoryName || "Handcrafted")}</span>
                            ${item.specs ? `<span class="product-specs-pill">${escapeHtml(item.specs)}</span>` : ""}
                        </div>

                        <h3 class="product-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
                        <p class="product-subtitle" title="${escapeHtml(item.subtitle)}">${escapeHtml(item.subtitle)}</p>
                        ${priceHtml}
                        
                        <div class="product-desc-container">
                            <p class="product-desc" id="desc-${item.id}">${escapeHtml(item.description)}</p>
                            <button type="button" class="btn-view-details" data-toggle-desc="${item.id}" aria-expanded="false">View Details</button>
                        </div>

                        <div class="product-highlights">
                            ${highlightsHtml}
                        </div>

                        <!-- Compact Unified Quantity + Add to Cart Row -->
                        <div class="product-actions-toolbar">
                            <div class="product-qty-compact" data-product-id="${item.id}">
                                <button type="button" class="qty-btn qty-btn-minus" data-action="minus" data-id="${item.id}" aria-label="Decrease quantity" ${isOutOfStock ? 'disabled' : ''}>&minus;</button>
                                <span class="qty-value" data-qty-display="${item.id}">${qty}</span>
                                <button type="button" class="qty-btn qty-btn-plus" data-action="plus" data-id="${item.id}" aria-label="Increase quantity" ${isOutOfStock ? 'disabled' : ''}>&plus;</button>
                            </div>

                            <button 
                                type="button" 
                                class="btn-order-wa btn-add-cart" 
                                data-add-cart="${item.id}"
                                title="${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}"
                                ${isOutOfStock ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                                    <line x1="3" y1="6" x2="21" y2="6"></line>
                                    <path d="M16 10a4 4 0 0 1-8 0"></path>
                                </svg>
                                <span class="btn-order-label">${isOutOfStock ? 'Sold Out' : 'Add to Cart'}</span>
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");

        // Attach Quantity Stepper handlers
        productsGrid.querySelectorAll(".qty-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = btn.getAttribute("data-id");
                const action = btn.getAttribute("data-action");
                let currentQty = state.quantities[id] || 1;
                if (action === "plus") {
                    currentQty += 1;
                } else if (action === "minus") {
                    currentQty = Math.max(1, currentQty - 1);
                }
                state.quantities[id] = currentQty;

                // Update display
                const displayEl = productsGrid.querySelector(`[data-qty-display="${id}"]`);
                if (displayEl) displayEl.textContent = currentQty;
            });
        });

        // Attach View Details toggle handlers
        productsGrid.querySelectorAll("[data-toggle-desc]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = btn.getAttribute("data-toggle-desc");
                const descEl = productsGrid.querySelector(`#desc-${id}`);
                if (!descEl) return;
                const isExpanded = descEl.classList.toggle("expanded");
                btn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
                btn.textContent = isExpanded ? "Show Less" : "View Details";
            });
        });

        // Attach Add to Cart handlers
        productsGrid.querySelectorAll("[data-add-cart]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = btn.getAttribute("data-add-cart");
                const qty = state.quantities[id] || 1;

                if (window.PaloraCart) {
                    const res = window.PaloraCart.addToCart(id, qty);
                    if (res && res.product) {
                        const label = btn.querySelector(".btn-order-label");
                        btn.classList.add("btn-added");
                        if (label) label.textContent = "Added ✓";
                        setTimeout(() => {
                            btn.classList.remove("btn-added");
                            if (label) label.textContent = "Add to Cart";
                        }, 1200);

                        const msg = `✓ Added "${res.product.title}" (${qty}) to cart`;
                        window.PaloraCart.showToast(msg, "View Cart →", "cart.html");
                    }
                }
            });
        });
    }

    /**
     * Category Circles Interaction (From the Mockup's 6 Circles)
     */
    function setupCategoryInteractions() {
        categoryButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const cat = btn.getAttribute("data-category");
                activateFilter(cat);

                // Smooth scroll to catalog
                const catalogEl = document.getElementById("products-catalog");
                if (catalogEl) {
                    catalogEl.scrollIntoView({ behavior: "smooth", block: "start" });
                }

                // Friendly toast
                const catName = btn.querySelector(".category-name")?.textContent || "Selected Category";
                showToast(`Viewing: ${catName}`);
            });
        });
    }

    /**
     * Setup Filter Tabs
     */
    function setupFilterTabs() {
        if (!catalogFilters) return;

        const filterTabs = catalogFilters.querySelectorAll(".filter-tab");
        filterTabs.forEach(tab => {
            tab.addEventListener("click", () => {
                const filter = tab.getAttribute("data-filter");
                activateFilter(filter);
            });
        });
    }

    function activateFilter(filterCategory) {
        state.activeFilter = filterCategory;

        // Update active tab styling
        if (catalogFilters) {
            const tabs = catalogFilters.querySelectorAll(".filter-tab");
            tabs.forEach(tab => {
                const f = tab.getAttribute("data-filter");
                if (f === filterCategory) {
                    tab.classList.add("active");
                    tab.setAttribute("aria-selected", "true");
                } else {
                    tab.classList.remove("active");
                    tab.setAttribute("aria-selected", "false");
                }
            });
        }

        // Filter products
        let filtered = state.products;
        if (filterCategory !== "all") {
            filtered = state.products.filter(p => p.category === filterCategory);
        }

        renderProducts(filtered);

        // Update subtitle if specific
        if (catalogSubtitle) {
            if (filterCategory === "all") {
                catalogSubtitle.textContent = "Available for direct WhatsApp order inquiries at +91 93198 62081";
            } else {
                catalogSubtitle.textContent = `Showing handcrafted selections in this collection (${filtered.length} items)`;
            }
        }
    }

    /**
     * Navigation & Smooth Scrolling
     */
    function setupNavigation() {
        // Sticky Header scroll styling
        window.addEventListener("scroll", () => {
            if (window.scrollY > 30) {
                navbar.classList.add("scrolled");
            } else {
                navbar.classList.remove("scrolled");
            }
        });

        // Mobile menu toggle
        if (mobileMenuBtn && navLinks) {
            mobileMenuBtn.addEventListener("click", () => {
                const isOpen = navLinks.classList.toggle("mobile-open");
                mobileMenuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
            });

            // Close on link click
            navLinks.querySelectorAll("a").forEach(a => {
                a.addEventListener("click", () => {
                    navLinks.classList.remove("mobile-open");
                    mobileMenuBtn.setAttribute("aria-expanded", "false");
                });
            });
        }

        // Nav Links Category quick links
        document.querySelectorAll("[data-cat]").forEach(link => {
            link.addEventListener("click", (e) => {
                const cat = link.getAttribute("data-cat");
                if (cat && cat !== "all") {
                    activateFilter(cat);
                } else {
                    activateFilter("all");
                }
            });
        });

        // Account / Consultation quick trigger
        if (accountBtn) {
            accountBtn.addEventListener("click", () => {
                const waUrl = getWhatsAppLink("Hello Palora Homes team, I would like to consult with your decor specialist regarding styling advice and custom inquiries.");
                window.open(waUrl, "_blank");
            });
        }
    }

    /**
     * Scroll Spy for Active Nav Item
     */
    function setupScrollObserver() {
        const sections = document.querySelectorAll("section[id]");
        const navItems = document.querySelectorAll(".nav-link");

        window.addEventListener("scroll", () => {
            let current = "home";
            const scrollY = window.pageYOffset;

            sections.forEach(section => {
                const sectionTop = section.offsetTop - 120;
                const sectionHeight = section.offsetHeight;
                if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                    current = section.getAttribute("id");
                }
            });

            navItems.forEach(link => {
                link.classList.remove("active");
                const href = link.getAttribute("href");
                if (href === `#${current}`) {
                    link.classList.add("active");
                }
            });
        });
    }

    /**
     * Search Modal Implementation
     */
    function setupSearchModal() {
        if (!searchBtn || !searchModal || !searchInput) return;

        searchBtn.addEventListener("click", () => {
            searchModal.classList.add("open");
            searchModal.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-open");
            searchInput.focus();
        });

        closeSearchBtn.addEventListener("click", closeSearch);
        searchModal.addEventListener("click", (e) => {
            if (e.target === searchModal) closeSearch();
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && searchModal.classList.contains("open")) {
                closeSearch();
            }
        });

        // Live input search
        searchInput.addEventListener("input", () => {
            const q = searchInput.value.trim().toLowerCase();
            if (!q) {
                searchResultsList.innerHTML = `<p class="search-hint">Type above to quickly find your favorite handcrafted home decor piece.</p>`;
                return;
            }

            const results = state.products.filter(p => {
                return (
                    p.title.toLowerCase().includes(q) ||
                    p.subtitle.toLowerCase().includes(q) ||
                    p.description.toLowerCase().includes(q) ||
                    p.categoryName.toLowerCase().includes(q) ||
                    (p.highlights && p.highlights.some(h => h.toLowerCase().includes(q)))
                );
            });

            if (results.length === 0) {
                searchResultsList.innerHTML = `<p class="search-hint">No products found matching "<strong>${escapeHtml(q)}</strong>". Try searching for "clock", "shelves", "lamp", "hanging", or "ganesha".</p>`;
                return;
            }

            searchResultsList.innerHTML = results.map(item => `
                <div class="search-result-item" data-goto="${item.id}">
                    <img src="${item.image}" alt="${escapeHtml(item.title)}" class="search-result-thumb">
                    <div class="search-result-info">
                        <h4>${escapeHtml(item.title)}</h4>
                        <p>${escapeHtml(item.categoryName)} &bull; ${escapeHtml(item.specs || "")}</p>
                    </div>
                </div>
            `).join("");

            // Click result to navigate
            searchResultsList.querySelectorAll("[data-goto]").forEach(item => {
                item.addEventListener("click", () => {
                    const id = item.getAttribute("data-goto");
                    closeSearch();
                    activateFilter("all");
                    const targetEl = document.querySelector(`[data-id="${id}"]`);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                        targetEl.style.outline = "2px solid var(--color-brown-800)";
                        setTimeout(() => targetEl.style.outline = "", 2000);
                    }
                });
            });
        });

        function closeSearch() {
            searchModal.classList.remove("open");
            searchModal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("modal-open");
            searchInput.value = "";
        }
    }

    /**
     * Shopping Bag / Inquiry Drawer Implementation
     */
    /**
     * Shopping Bag / Inquiry Drawer Implementation
     */
    function setupCartDrawer() {
        if (!cartDrawer) return;

        // If cartBtn exists and is clicked, let it navigate to cart.html naturally.
        // We also sync with PaloraCart custom events
        window.addEventListener("palora:cart-updated", () => {
            if (cartDrawer.classList.contains("open")) {
                renderCartDrawer();
            }
        });

        if (closeCartBtn) closeCartBtn.addEventListener("click", closeCart);
        cartDrawer.addEventListener("click", (e) => {
            if (e.target === cartDrawer) closeCart();
        });

        // Proceed to Customer Details from Drawer
        if (checkoutWaBtn) {
            checkoutWaBtn.addEventListener("click", () => {
                const cart = window.PaloraCart ? window.PaloraCart.getCart() : [];
                if (cart && cart.length > 0) {
                    window.location.href = "cart.html?step=checkout";
                } else {
                    showToast("Your shopping cart is empty.");
                }
            });
        }

        function closeCart() {
            cartDrawer.classList.remove("open");
            cartDrawer.setAttribute("aria-hidden", "true");
            document.body.classList.remove("modal-open");
        }
    }

    function renderCartDrawer() {
        if (!cartItemsList) return;

        const cart = window.PaloraCart ? window.PaloraCart.getCart() : [];

        if (cart.length === 0) {
            cartItemsList.innerHTML = `
                <div class="cart-empty-message">
                    <p style="font-size: 1.1rem; color: var(--color-brown-700); margin-bottom: 8px;">Your Cart is Empty</p>
                    <p style="font-size: 0.84rem;">Click "Add to Cart" on any product card or put curated category items into cart.</p>
                    <button type="button" class="btn-drawer-seed" id="btnDrawerSeedCategory" style="margin-top: 14px; background: var(--color-brown-800); color: #fff; border: none; padding: 8px 16px; border-radius: 20px; font-size: 0.82rem; cursor: pointer; font-weight: 600;">
                        ✨ Put Curated Items into Cart by Categories
                    </button>
                </div>
            `;
            const drawerSeedBtn = cartItemsList.querySelector('#btnDrawerSeedCategory');
            if (drawerSeedBtn) {
                drawerSeedBtn.addEventListener('click', () => {
                    if (window.PaloraCart) {
                        window.PaloraCart.seedCategoryCart(true);
                        renderCartDrawer();
                    }
                });
            }
            return;
        }

        const groups = window.PaloraCart ? window.PaloraCart.getCartGroupedByCategory() : [];

        cartItemsList.innerHTML = groups.map(group => `
            <div class="drawer-category-section" style="margin-bottom: 16px;">
                <div class="drawer-category-header" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: #FAF5ED; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid var(--color-brown-800);">
                    <span class="drawer-cat-icon">${escapeHtml(group.icon)}</span>
                    <strong style="font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-brown-800);">${escapeHtml(group.categoryName)}</strong>
                    <span style="margin-left: auto; font-size: 0.74rem; background: #E9DEC8; padding: 1px 7px; border-radius: 10px; font-weight: 700; color: var(--color-brown-900);">${group.totalQty}</span>
                </div>
                <div class="drawer-category-items">
                    ${group.items.map(item => `
                        <div class="cart-item-row">
                            <img src="${item.image}" alt="${escapeHtml(item.title)}" class="cart-item-img">
                            <div class="cart-item-details">
                                <h5>${escapeHtml(item.title)}</h5>
                                <span>${escapeHtml(item.specs || item.categoryName)}</span>
                                <span style="font-size: 0.78rem; font-weight: 600; color: var(--color-brown-800);">Qty: ${item.quantity || 1}</span>
                            </div>
                            <button class="cart-item-remove" data-remove-id="${item.id}" aria-label="Remove item">&times;</button>
                        </div>
                    `).join("")}
                </div>
            </div>
        `).join("");

        // Remove items via event delegation on cartItemsList
        cartItemsList.onclick = (e) => {
            const btn = e.target.closest("[data-remove-id]");
            if (btn && window.PaloraCart) {
                e.preventDefault();
                const id = btn.getAttribute("data-remove-id");
                window.PaloraCart.removeFromCart(id);
                if (window.PaloraCart.showToast) {
                    window.PaloraCart.showToast("Item removed from cart");
                } else if (typeof showToast === "function") {
                    showToast("Item removed from cart");
                }
                renderCartDrawer();
            }
        };
    }

    /**
     * Direct WhatsApp Inquiry Form
     */
    function setupInquiryForm() {
        if (!quickInquiryForm) return;

        quickInquiryForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const name = document.getElementById("formName")?.value.trim() || "";
            const phone = document.getElementById("formPhone")?.value.trim() || "";
            const category = document.getElementById("formCategory")?.value || "All Collections";
            const message = document.getElementById("formMessage")?.value.trim() || "";

            if (!name || !message) {
                showToast("Please fill in your name and message requirements.");
                return;
            }

            let msg = `Hello Palora Homes, I would like to submit an inquiry:\n\n`;
            msg += `*Name:* ${name}\n`;
            if (phone) msg += `*WhatsApp:* ${phone}\n`;
            msg += `*Category of Interest:* ${category}\n`;
            msg += `*Message:* ${message}\n\n`;
            msg += `Please reply with product availability and assistance. Thank you!`;

            const waUrl = getWhatsAppLink(msg);
            window.open(waUrl, "_blank");
            showToast("Opening WhatsApp inquiry chat with Palora Homes...");
            quickInquiryForm.reset();
        });
    }

    /**
     * Floating Tooltip Bubble
     */
    function setupFloatingTooltip() {
        if (bubbleCloseBtn && waBubble) {
            bubbleCloseBtn.addEventListener("click", () => {
                waBubble.style.display = "none";
            });
        }
    }
});
