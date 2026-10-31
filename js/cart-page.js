/**
 * Palora Homes - Dedicated Shopping Cart & Checkout Page Controller
 * Supports 2-step checkout flow:
 *   Step 1: Categorized Cart Review (Items, Quantities, Category Filters, Pricing)
 *   Step 2: Customer & Delivery Details Form (Validation, Persistence, and WhatsApp Order Inquiry)
 */

(function () {
    'use strict';

    // Current checkout flow step: 'cart' or 'checkout'
    let currentStep = 'cart';

    // Check URL parameters for direct step navigation (e.g. from drawer)
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('step') === 'checkout') {
            currentStep = 'checkout';
        }
    } catch (e) {
        // Fallback for older browsers
    }

    // Current category filter in cart ('all' or category ID)
    let currentCategoryFilter = 'all';

    // Comprehensive list of 28 Indian States & 8 Union Territories
    const INDIAN_STATES = [
        'Andaman and Nicobar Islands',
        'Andhra Pradesh',
        'Arunachal Pradesh',
        'Assam',
        'Bihar',
        'Chandigarh',
        'Chhattisgarh',
        'Dadra and Nagar Haveli and Daman and Diu',
        'Delhi',
        'Goa',
        'Gujarat',
        'Haryana',
        'Himachal Pradesh',
        'Jammu and Kashmir',
        'Jharkhand',
        'Karnataka',
        'Kerala',
        'Ladakh',
        'Lakshadweep',
        'Madhya Pradesh',
        'Maharashtra',
        'Manipur',
        'Meghalaya',
        'Mizoram',
        'Nagaland',
        'Odisha',
        'Puducherry',
        'Punjab',
        'Rajasthan',
        'Sikkim',
        'Tamil Nadu',
        'Telangana',
        'Tripura',
        'Uttar Pradesh',
        'Uttarakhand',
        'West Bengal'
    ];

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Render the visual checkout progress stepper
     */
    function renderStepperBar(step) {
        const isCart = (step === 'cart');
        const isCheckout = (step === 'checkout');

        return `
            <div class="checkout-stepper-wrap" aria-label="Checkout Progress">
                <div class="checkout-stepper-bar">
                    <button type="button" class="stepper-step ${isCart ? 'active' : 'completed'}" data-nav-step="cart" aria-label="Step 1: Cart Review">
                        <span class="step-circle">${isCheckout ? '✓' : '1'}</span>
                        <span class="step-meta">
                            <strong class="step-title">Cart Review</strong>
                            <span class="step-sub">Selected Pieces</span>
                        </span>
                    </button>

                    <div class="stepper-line ${isCheckout ? 'completed' : ''}"></div>

                    <div class="stepper-step ${isCheckout ? 'active' : 'upcoming'}" aria-current="${isCheckout ? 'step' : 'false'}">
                        <span class="step-circle">2</span>
                        <span class="step-meta">
                            <strong class="step-title">Customer &amp; Delivery</strong>
                            <span class="step-sub">Address &amp; Contact</span>
                        </span>
                    </div>

                    <div class="stepper-line"></div>

                    <div class="stepper-step upcoming" aria-label="Step 3: WhatsApp Confirmation">
                        <span class="step-circle">3</span>
                        <span class="step-meta">
                            <strong class="step-title">WhatsApp Order</strong>
                            <span class="step-sub">Official Inquiry</span>
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Main render router for Cart & Checkout
     */
    function renderCartPage() {
        const root = document.getElementById('cartViewRoot');
        if (!root) return;

        setupCartDelegatedListeners(root);

        const cart = window.PaloraCart ? window.PaloraCart.getCart() : [];

        // 1. If cart is empty, always show the empty cart state
        if (cart.length === 0) {
            currentStep = 'cart';
            root.innerHTML = `
                <div class="cart-empty-state">
                    <div class="empty-icon-wrap" aria-hidden="true">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <path d="M16 10a4 4 0 0 1-8 0"></path>
                        </svg>
                    </div>
                    <h2 class="empty-title">Your Shopping Cart is Empty</h2>
                    <p class="empty-desc">You haven't added any pieces to your cart yet. Discover our artisanal wall decor, clocks, night lamps, and living accents.</p>
                    
                    <div class="empty-actions-row">
                        <button type="button" class="btn-seed-category-cart" id="btnSeedCategoryCartEmpty">
                            <span class="btn-icon">✨</span>
                            <span>Put Curated Items into Cart by Categories</span>
                        </button>
                        <a href="index.html#products-catalog" class="btn-explore-catalog">
                            Explore Full Catalog &rarr;
                        </a>
                    </div>
                </div>
            `;
            return;
        }

        const groups = window.PaloraCart ? window.PaloraCart.getCartGroupedByCategory() : [];

        // Totals calculation
        let totalQty = 0;
        let totalPrice = 0;
        let hasPrices = false;

        cart.forEach(function (item) {
            const qty = parseInt(item.quantity, 10) || 1;
            totalQty += qty;
            if (typeof item.price === 'number' && !isNaN(item.price)) {
                hasPrices = true;
                totalPrice += item.price * qty;
            }
        });

        const breadcrumbCurrent = document.querySelector('.breadcrumb-current');
        const pageTitle = document.querySelector('.cart-page-title');
        const pageSubtitle = document.querySelector('.cart-page-subtitle');

        // Route to Step 2: Customer & Delivery Details View
        if (currentStep === 'checkout') {
            if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Customer & Delivery Details';
            if (pageTitle) pageTitle.textContent = 'Customer & Delivery Details';
            if (pageSubtitle) pageSubtitle.textContent = 'Provide your delivery address and contact information to confirm your order on WhatsApp.';
            renderCustomerDetailsStep(root, cart, groups, totalQty, totalPrice, hasPrices);
            return;
        }

        // Route to Step 1: Cart Items Selections View
        if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Shopping Cart';
        if (pageTitle) pageTitle.textContent = 'Your Shopping Cart';
        if (pageSubtitle) pageSubtitle.textContent = 'Review your handcrafted selections and order directly with Palora Homes on WhatsApp.';
        renderCartItemsStep(root, cart, groups, totalQty, totalPrice, hasPrices);
    }

    /**
     * Render Step 1: Shopping Cart Review & Items List
     */
    function renderCartItemsStep(root, cart, groups, totalQty, totalPrice, hasPrices) {
        // If current filter category is not present in cart anymore, reset to 'all'
        const filterExists = currentCategoryFilter === 'all' || groups.some(function (g) {
            return g.category === currentCategoryFilter;
        });
        if (!filterExists) {
            currentCategoryFilter = 'all';
        }

        // Category Filter Navigation Tabs
        const categoryFilterTabsHtml = `
            <div class="cart-category-tabs-bar" role="tablist" aria-label="Filter cart items by category">
                <button type="button" class="cart-cat-tab ${currentCategoryFilter === 'all' ? 'active' : ''}" data-cat-filter="all" role="tab" aria-selected="${currentCategoryFilter === 'all'}">
                    <span class="tab-icon">🏷️</span>
                    <span class="tab-name">All Categories</span>
                    <span class="tab-badge">${totalQty}</span>
                </button>
                ${groups.map(function (g) {
                    const isActive = currentCategoryFilter === g.category;
                    return `
                        <button type="button" class="cart-cat-tab ${isActive ? 'active' : ''}" data-cat-filter="${escapeHtml(g.category)}" role="tab" aria-selected="${isActive}">
                            <span class="tab-icon">${escapeHtml(g.icon)}</span>
                            <span class="tab-name">${escapeHtml(g.categoryName)}</span>
                            <span class="tab-badge">${g.totalQty}</span>
                        </button>
                    `;
                }).join('')}
            </div>
        `;

        // Category Sections with Individual Item Cards
        const categorySectionsHtml = groups.map(function (group) {
            const isVisible = (currentCategoryFilter === 'all' || currentCategoryFilter === group.category);
            const displayStyle = isVisible ? '' : 'style="display: none;"';

            const itemsInGroupHtml = group.items.map(function (item) {
                const qty = parseInt(item.quantity, 10) || 1;
                const itemPriceDisplay = (typeof item.price === 'number' && !isNaN(item.price))
                    ? `₹${item.price.toLocaleString('en-IN')}`
                    : `<span class="price-inquiry-tag">Inquiry Quote</span>`;

                const itemSubtotalDisplay = (typeof item.price === 'number' && !isNaN(item.price))
                    ? `₹${(item.price * qty).toLocaleString('en-IN')}`
                    : `<span class="price-inquiry-sub">Direct WhatsApp Quote</span>`;

                return `
                    <div class="cart-item-card" data-product-id="${item.id}" data-item-category="${escapeHtml(item.category)}">
                        <div class="cart-item-img-wrap">
                            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="cart-item-img" loading="lazy">
                        </div>

                        <div class="cart-item-info">
                            <div class="cart-item-cat-badge">
                                <span class="cat-pill-icon">${escapeHtml(group.icon)}</span>
                                <span class="cat-pill-text">${escapeHtml(item.categoryName || group.categoryName)}</span>
                            </div>
                            <h4 class="cart-item-title">${escapeHtml(item.title)}</h4>
                            ${item.specs ? `<div class="cart-item-specs-badge">${escapeHtml(item.specs)}</div>` : ''}
                            
                            <div class="cart-item-unit-price">
                                <span class="label">Unit Price:</span> ${itemPriceDisplay}
                            </div>
                        </div>

                        <div class="cart-item-quantity-col">
                            <span class="qty-label-mobile">Quantity:</span>
                            <div class="cart-qty-control">
                                <button type="button" class="cart-qty-btn" data-action="minus" data-id="${item.id}" aria-label="Decrease quantity of ${escapeHtml(item.title)}">&minus;</button>
                                <span class="cart-qty-number">${qty}</span>
                                <button type="button" class="cart-qty-btn" data-action="plus" data-id="${item.id}" aria-label="Increase quantity of ${escapeHtml(item.title)}">&plus;</button>
                            </div>
                        </div>

                        <div class="cart-item-subtotal-col">
                            <span class="subtotal-label">Subtotal:</span>
                            <span class="subtotal-amount">${itemSubtotalDisplay}</span>
                        </div>

                        <div class="cart-item-remove-col">
                            <button type="button" class="btn-remove-item" data-remove-id="${item.id}" aria-label="Remove ${escapeHtml(item.title)} from cart" title="Remove item">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                                <span class="remove-text">Remove</span>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <section class="cart-category-group-section" data-cat-section="${escapeHtml(group.category)}" ${displayStyle}>
                    <div class="cart-category-group-header">
                        <div class="cat-group-header-left">
                            <span class="cat-group-icon" aria-hidden="true">${escapeHtml(group.icon)}</span>
                            <div class="cat-group-title-wrap">
                                <h3 class="cat-group-title">${escapeHtml(group.categoryName)}</h3>
                                <span class="cat-group-count-pill">${group.totalQty} piece${group.totalQty > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        <a href="index.html#products-catalog" class="cat-group-browse-link" data-browse-cat="${escapeHtml(group.category)}">
                            <span>Browse more ${escapeHtml(group.categoryName)}</span>
                            <span aria-hidden="true">&rarr;</span>
                        </a>
                    </div>

                    <div class="cart-category-items-container">
                        ${itemsInGroupHtml}
                    </div>
                </section>
            `;
        }).join('');

        // Category Breakdown for Order Summary Card
        const categoryBreakdownHtml = groups.map(function (g) {
            return `
                <div class="summary-category-row">
                    <span class="summary-cat-label">
                        <span class="summary-cat-icon">${escapeHtml(g.icon)}</span>
                        <span>${escapeHtml(g.categoryName)}</span>
                    </span>
                    <span class="summary-cat-qty">${g.totalQty} pc${g.totalQty > 1 ? 's' : ''}</span>
                </div>
            `;
        }).join('');

        const summaryPriceHtml = hasPrices
            ? `
                <div class="summary-line">
                    <span>Subtotal:</span>
                    <span class="summary-val">₹${totalPrice.toLocaleString('en-IN')}</span>
                </div>
                <div class="summary-line">
                    <span>Shipping:</span>
                    <span class="summary-val text-green">Calculated on WhatsApp</span>
                </div>
                <div class="summary-divider"></div>
                <div class="summary-line summary-total">
                    <span>Estimated Total:</span>
                    <span class="summary-total-val">₹${totalPrice.toLocaleString('en-IN')}</span>
                </div>
            `
            : `
                <div class="summary-line">
                    <span>Order Structure:</span>
                    <span class="summary-val text-brown-bold">Categorized Order</span>
                </div>
                <div class="summary-line">
                    <span>Categories Included:</span>
                    <span class="summary-val text-gold-bold">${groups.length} Distinct Collections</span>
                </div>
                <div class="summary-line">
                    <span>Pricing Status:</span>
                    <span class="summary-val text-green">Verified on WhatsApp Inquiry</span>
                </div>
                <div class="summary-divider"></div>
                <div class="summary-line summary-total">
                    <span>Total Pieces:</span>
                    <span class="summary-total-val">${totalQty} piece${totalQty > 1 ? 's' : ''}</span>
                </div>
            `;

        root.innerHTML = `
            ${renderStepperBar('cart')}

            <div class="cart-category-banner">
                <div class="cat-banner-content">
                    <div class="cat-banner-icon">📁</div>
                    <div class="cat-banner-text">
                        <strong>Categorized Shopping Cart Active</strong>
                        <p>Your pieces are organized by category for direct WhatsApp inquiry &amp; packaged fulfillment.</p>
                    </div>
                </div>
                <div class="cat-banner-actions">
                    <button type="button" class="btn-banner-reseed" id="btnReseedCategoryCart" title="Load or reset curated category items from catalog">
                        <span>↺ Reset to Curated Items</span>
                    </button>
                </div>
            </div>

            <!-- Category Filter Tabs -->
            ${categoryFilterTabsHtml}

            <div class="cart-layout-grid">
                <!-- Left: Items Categorized Column -->
                <div class="cart-items-column">
                    <div class="cart-items-header-bar">
                        <div class="header-items-count">
                            <span>Cart Selections (${totalQty} Pieces across ${groups.length} Categories)</span>
                        </div>
                        <div class="header-actions-right">
                            <button type="button" class="btn-clear-cart-link" id="btnClearCartTop">Clear All</button>
                        </div>
                    </div>

                    <!-- Category Sections Container -->
                    <div class="cart-category-sections-wrapper" id="cartCategorySections">
                        ${categorySectionsHtml}
                    </div>

                    <div class="cart-items-footer-nav">
                        <a href="index.html#products-catalog" class="btn-continue-shopping">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            Continue Shopping Full Collections
                        </a>
                    </div>
                </div>

                <!-- Right: Order Summary Card -->
                <div class="cart-summary-column">
                    <div class="cart-summary-card">
                        <h2 class="summary-heading">Order Summary</h2>
                        <div class="summary-count-badge">${totalQty} Selected Piece${totalQty > 1 ? 's' : ''} &bull; ${groups.length} Categories</div>

                        <!-- Category Breakdown Box -->
                        <div class="summary-category-breakdown-card">
                            <div class="breakdown-header">
                                <span class="breakdown-title">Categorized Breakdown</span>
                                <span class="breakdown-pill">${groups.length} Categories</span>
                            </div>
                            <div class="breakdown-items-list">
                                ${categoryBreakdownHtml}
                            </div>
                        </div>

                        <div class="summary-lines-box">
                            ${summaryPriceHtml}
                        </div>

                        <!-- Palora WhatsApp Assurance -->
                        <div class="summary-perks">
                            <div class="perk-item">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                                <span>Official WhatsApp Confirmation (+91 93198 62081)</span>
                            </div>
                            <div class="perk-item">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="1" y="3" width="15" height="13"></rect>
                                    <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
                                    <circle cx="5.5" cy="18.5" r="2.5"></circle>
                                    <circle cx="18.5" cy="18.5" r="2.5"></circle>
                                </svg>
                                <span>Categorized Safe Bubble &amp; Foam Packaging</span>
                            </div>
                            <div class="perk-item">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                                <span>Direct Customization by Artisans</span>
                            </div>
                        </div>

                        <!-- Proceed to Customer Details Button -->
                        <button type="button" class="btn-proceed-checkout" id="btnProceedToCustomerDetails">
                            <span class="btn-proceed-main">Proceed to Customer Details</span>
                            <span class="btn-proceed-arrow" aria-hidden="true">&rarr;</span>
                        </button>

                        <!-- Direct Cart PDF Inquiry Sheet Button -->
                        <button type="button" class="btn-cart-download-pdf-secondary" id="btnCartPreviewPDF" title="Download or preview your PDF Order Sheet">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                            <span>Download PDF Order Sheet (A4)</span>
                        </button>

                        <p class="summary-note">Next: Enter your delivery details before sending your order inquiry to Palora Homes on WhatsApp.</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Step 2: Customer & Delivery Details Form + Order Review
     */
    function renderCustomerDetailsStep(root, cart, groups, totalQty, totalPrice, hasPrices) {
        // Retrieve any previously saved customer details to preserve form state
        const details = window.PaloraCart ? window.PaloraCart.getCustomerDetails() : {};

        // Build mini order review items list
        const reviewItemsHtml = cart.map(function (item) {
            const qty = parseInt(item.quantity, 10) || 1;
            const priceText = (typeof item.price === 'number' && !isNaN(item.price))
                ? `₹${(item.price * qty).toLocaleString('en-IN')}`
                : `<span class="price-inquiry-tag">Inquiry Quote</span>`;

            return `
                <div class="checkout-review-item">
                    <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="review-item-img" loading="lazy">
                    <div class="review-item-details">
                        <h4 class="review-item-title">${escapeHtml(item.title)}</h4>
                        ${item.specs ? `<span class="review-item-specs">${escapeHtml(item.specs)}</span>` : ''}
                        <div class="review-item-bottom">
                            <span class="review-item-qty">Qty: <strong>${qty}</strong></span>
                            <span class="review-item-price">${priceText}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        root.innerHTML = `
            ${renderStepperBar('checkout')}

            <div class="checkout-form-header">
                <div class="checkout-header-badge">
                    <span class="badge-icon">📍</span>
                    <span>Step 2 of 2</span>
                </div>
                <h2 class="checkout-main-heading">Customer &amp; Delivery Details</h2>
                <p class="checkout-main-sub">Please enter your contact and delivery address below. Your details will be pre-filled into your official WhatsApp order inquiry for prompt confirmation.</p>
            </div>

            <div class="checkout-layout-grid">
                <!-- Left: Clean, Premium Customer Form -->
                <div class="checkout-form-column">
                    <form id="customerDetailsForm" class="customer-details-card" novalidate>
                        <div class="card-section-heading">
                            <span class="section-badge-num">1</span>
                            <div>
                                <h3 class="section-title">Contact &amp; Delivery Information</h3>
                                <p class="section-sub">Required fields are marked with an asterisk (<span class="required-star">*</span>)</p>
                            </div>
                        </div>

                        <div class="form-grid">
                            <!-- Full Name (Required) -->
                            <div class="form-field full-width" id="group-fullName">
                                <label for="custFullName" class="form-label">
                                    Full Name <span class="required-star">*</span>
                                </label>
                                <div class="input-wrap">
                                    <input 
                                        type="text" 
                                        id="custFullName" 
                                        name="fullName" 
                                        class="form-input" 
                                        placeholder="e.g. Rahul Sharma" 
                                        value="${escapeHtml(details.fullName)}" 
                                        required 
                                        autocomplete="name"
                                    >
                                </div>
                                <span class="field-error-text" id="err-fullName"></span>
                            </div>

                            <!-- Mobile Number (Required) -->
                            <div class="form-field full-width" id="group-mobileNumber">
                                <label for="custMobile" class="form-label">
                                    Mobile Number <span class="required-star">*</span>
                                </label>
                                <div class="phone-input-wrap">
                                    <span class="phone-prefix-tag">+91</span>
                                    <input 
                                        type="tel" 
                                        id="custMobile" 
                                        name="mobileNumber" 
                                        class="form-input phone-input" 
                                        placeholder="10-digit mobile number" 
                                        value="${escapeHtml(details.mobileNumber)}" 
                                        required 
                                        autocomplete="tel" 
                                        maxlength="14"
                                    >
                                </div>
                                <span class="field-error-text" id="err-mobileNumber"></span>
                                <span class="field-help-text">Used for WhatsApp inquiry confirmation, shipping updates, and delivery dispatch.</span>
                            </div>

                            <!-- Complete Delivery Address (Required) -->
                            <div class="form-field full-width" id="group-address">
                                <label for="custAddress" class="form-label">
                                    Complete Delivery Address <span class="required-star">*</span>
                                </label>
                                <div class="input-wrap">
                                    <textarea 
                                        id="custAddress" 
                                        name="address" 
                                        class="form-textarea" 
                                        rows="3" 
                                        placeholder="House/Flat No., Apartment / Building Name, Street / Road, Nearby Landmark, Sector / Locality" 
                                        required 
                                        autocomplete="street-address"
                                    >${escapeHtml(details.address)}</textarea>
                                </div>
                                <span class="field-error-text" id="err-address"></span>
                            </div>

                            <!-- City (Required) -->
                            <div class="form-field half-width" id="group-city">
                                <label for="custCity" class="form-label">
                                    City <span class="required-star">*</span>
                                </label>
                                <div class="input-wrap">
                                    <input 
                                        type="text" 
                                        id="custCity" 
                                        name="city" 
                                        class="form-input" 
                                        placeholder="e.g. New Delhi / Bengaluru" 
                                        value="${escapeHtml(details.city)}" 
                                        required 
                                        autocomplete="address-level2"
                                    >
                                </div>
                                <span class="field-error-text" id="err-city"></span>
                            </div>

                            <!-- State (Required) -->
                            <div class="form-field half-width" id="group-state">
                                <label for="custState" class="form-label">
                                    State <span class="required-star">*</span>
                                </label>
                                <div class="input-wrap">
                                    <select id="custState" name="state" class="form-select" required autocomplete="address-level1">
                                        <option value="">Select State / UT</option>
                                        ${INDIAN_STATES.map(function (st) {
                                            const isSelected = (details.state === st);
                                            return `<option value="${escapeHtml(st)}" ${isSelected ? 'selected' : ''}>${escapeHtml(st)}</option>`;
                                        }).join('')}
                                    </select>
                                </div>
                                <span class="field-error-text" id="err-state"></span>
                            </div>

                            <!-- PIN Code (Required) -->
                            <div class="form-field half-width" id="group-pincode">
                                <label for="custPincode" class="form-label">
                                    PIN Code <span class="required-star">*</span>
                                </label>
                                <div class="input-wrap">
                                    <input 
                                        type="text" 
                                        id="custPincode" 
                                        name="pincode" 
                                        class="form-input" 
                                        placeholder="6-digit PIN code" 
                                        value="${escapeHtml(details.pincode)}" 
                                        required 
                                        maxlength="6" 
                                        inputmode="numeric" 
                                        autocomplete="postal-code"
                                    >
                                </div>
                                <span class="field-error-text" id="err-pincode"></span>
                            </div>

                            <!-- Optional Order Notes -->
                            <div class="form-field full-width" id="group-notes">
                                <label for="custNotes" class="form-label">
                                    Order Notes <span class="optional-label">(Optional)</span>
                                </label>
                                <div class="input-wrap">
                                    <textarea 
                                        id="custNotes" 
                                        name="notes" 
                                        class="form-textarea" 
                                        rows="2" 
                                        placeholder="Any special packaging instructions, preferred delivery timing, or custom requirements..."
                                    >${escapeHtml(details.notes)}</textarea>
                                </div>
                                <span class="field-help-text">E.g., Call before delivery, gift packaging, or specific date requirement.</span>
                            </div>
                        </div>

                        <!-- Form Actions: Back to Cart, Download PDF & Send Order on WhatsApp -->
                        <div class="checkout-form-actions-bar">
                            <button type="button" class="btn-checkout-back" id="btnBackToCart">
                                <span class="btn-back-arrow" aria-hidden="true">&larr;</span>
                                <span>Back to Cart</span>
                            </button>

                            <div class="checkout-actions-right-group">
                                <button type="button" class="btn-checkout-download-pdf" id="btnDirectDownloadPDF" title="Download Printable A4 Order Inquiry Sheet with customer details">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    <span>Download PDF Sheet</span>
                                </button>

                                <button type="submit" class="btn-checkout-submit-wa" id="btnSendOrderWhatsApp">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.507 14.307l-.009.075c-2.387-1.196-2.822-1.423-3.26-1.077-.282.223-.559.57-.866.864-.325.312-.662.355-1.189.09-1.996-1.002-3.32-2.316-4.329-4.306-.264-.523-.223-.859.088-1.185.293-.309.642-.584.866-.867.348-.439.12-1.076-1.074-3.465C8.423 3.738 8.01 3.753 7.643 3.753c-.328 0-.712.112-1.085.518-.372.408-1.425 1.391-1.425 3.394 0 2.003 1.458 3.94 1.66 4.215.204.275 2.872 4.385 6.958 6.147 2.721 1.173 3.805 1.055 4.496.985.992-.102 2.387-.977 2.724-1.924.338-.948.338-1.761.238-1.925-.102-.164-.372-.266-.702-.456zM12 2a10 10 0 0 0-8.66 15L2 22l5.14-1.34A10 10 0 1 0 12 2z"/>
                                    </svg>
                                    <span class="btn-wa-text-wrap">
                                        <span class="btn-wa-main-text">Send Order on WhatsApp</span>
                                        <span class="btn-wa-sub-text">Sends delivery details to +91 93198 62081</span>
                                    </span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                <!-- Right: Order Review Sidebar Card -->
                <div class="checkout-summary-column">
                    <div class="checkout-review-card">
                        <div class="review-card-header">
                            <div>
                                <h3 class="review-card-title">Order Items Review</h3>
                                <span class="review-card-sub">${totalQty} piece${totalQty > 1 ? 's' : ''} across ${groups.length} categories</span>
                            </div>
                            <button type="button" class="btn-edit-cart-link" id="btnEditCartFromReview">
                                <span>Edit Cart</span>
                                <span aria-hidden="true">&rarr;</span>
                            </button>
                        </div>

                        <!-- Mini Items Scroll List -->
                        <div class="review-items-container">
                            ${reviewItemsHtml}
                        </div>

                        <!-- Breakdown and Totals -->
                        <div class="review-totals-box">
                            <div class="review-totals-row">
                                <span>Total Pieces:</span>
                                <strong>${totalQty} pcs</strong>
                            </div>
                            <div class="review-totals-row">
                                <span>Categories:</span>
                                <strong>${groups.length} distinct</strong>
                            </div>
                            <div class="review-totals-row">
                                <span>Pricing Status:</span>
                                <span class="text-green">${hasPrices ? '₹' + totalPrice.toLocaleString('en-IN') + ' (Estimated)' : 'Inquiry Quote'}</span>
                            </div>
                            <div class="review-divider"></div>
                            <div class="review-totals-row review-highlight">
                                <span>WhatsApp Order:</span>
                                <span>+91 93198 62081</span>
                            </div>
                        </div>

                        <!-- Trust Perks in Checkout -->
                        <div class="review-perks-box">
                            <div class="review-perk-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                <span>Verified official Palora Homes business inquiry</span>
                            </div>
                            <div class="review-perk-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="1" y="3" width="15" height="13"></rect>
                                    <polygon points="16 8 20 8 23 11 23 16 16 8"></polygon>
                                </svg>
                                <span>Pan-India transit safety packaging</span>
                            </div>
                            <div class="review-perk-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                <span>Direct artisan customization before dispatch</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Read current customer form input values
     */
    function getFormValues(container) {
        return {
            fullName: (container.querySelector('#custFullName')?.value || '').trim(),
            mobileNumber: (container.querySelector('#custMobile')?.value || '').trim(),
            address: (container.querySelector('#custAddress')?.value || '').trim(),
            city: (container.querySelector('#custCity')?.value || '').trim(),
            state: (container.querySelector('#custState')?.value || '').trim(),
            pincode: (container.querySelector('#custPincode')?.value || '').trim(),
            notes: (container.querySelector('#custNotes')?.value || '').trim()
        };
    }

    /**
     * Clear all validation errors
     */
    function clearAllFormErrors(container) {
        container.querySelectorAll('.form-field').forEach(function (group) {
            group.classList.remove('has-error');
        });
        container.querySelectorAll('.field-error-text').forEach(function (el) {
            el.textContent = '';
        });
    }

    /**
     * Show validation error on a specific field
     */
    function showFieldError(container, fieldId, message) {
        const group = container.querySelector('#group-' + fieldId);
        const errEl = container.querySelector('#err-' + fieldId);
        if (group) group.classList.add('has-error');
        if (errEl) errEl.textContent = '⚠️ ' + message;
    }

    /**
     * Validate the Customer & Delivery Details form
     * @returns {Object|null} Validated customer details or null if invalid
     */
    function validateCustomerForm(container) {
        clearAllFormErrors(container);
        const values = getFormValues(container);

        let firstInvalidInput = null;
        let isValid = true;

        // 1. Full Name: required, minimum 2 characters
        if (!values.fullName) {
            showFieldError(container, 'fullName', 'Please enter your Full Name.');
            if (!firstInvalidInput) firstInvalidInput = container.querySelector('#custFullName');
            isValid = false;
        } else if (values.fullName.length < 2) {
            showFieldError(container, 'fullName', 'Full Name must be at least 2 characters.');
            if (!firstInvalidInput) firstInvalidInput = container.querySelector('#custFullName');
            isValid = false;
        }

        // 2. Mobile Number: required, valid 10-digit Indian mobile number
        let cleanMobile = values.mobileNumber.replace(/[\s\-\(\)\+]/g, '');
        if (cleanMobile.startsWith('91') && cleanMobile.length === 12) {
            cleanMobile = cleanMobile.substring(2);
        }
        if (!values.mobileNumber) {
            showFieldError(container, 'mobileNumber', 'Please enter your Mobile Number.');
            if (!firstInvalidInput) firstInvalidInput = container.querySelector('#custMobile');
            isValid = false;
        } else if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
            showFieldError(container, 'mobileNumber', 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
            if (!firstInvalidInput) firstInvalidInput = container.querySelector('#custMobile');
            isValid = false;
        }

        // 3. Complete Delivery Address: required, minimum 8 characters
        if (!values.address) {
            showFieldError(container, 'address', 'Please enter your complete delivery address.');
            if (!firstInvalidInput) firstInvalidInput = container.querySelector('#custAddress');
            isValid = false;
        } else if (values.address.length < 8) {
            showFieldError(container, 'address', 'Please include House/Flat No., Street, and Landmark for safe delivery.');
            if (!firstInvalidInput) firstInvalidInput = container.querySelector('#custAddress');
            isValid = false;
        }

        // 4. City: required, minimum 2 characters
        if (!values.city) {
            showFieldError(container, 'city', 'Please enter your delivery City.');
            if (!firstInvalidInput) firstInvalidInput = container.querySelector('#custCity');
            isValid = false;
        } else if (values.city.length < 2) {
            showFieldError(container, 'city', 'Please enter a valid City name.');
            if (!firstInvalidInput) firstInvalidInput = container.querySelector('#custCity');
            isValid = false;
        }

        // 5. State: required
        if (!values.state) {
            showFieldError(container, 'state', 'Please select your delivery State / UT.');
            if (!firstInvalidInput) firstInvalidInput = container.querySelector('#custState');
            isValid = false;
        }

        // 6. PIN Code: required, valid 6-digit postal code
        const cleanPin = values.pincode.replace(/\s+/g, '');
        if (!values.pincode) {
            showFieldError(container, 'pincode', 'Please enter your 6-digit delivery PIN Code.');
            if (!firstInvalidInput) firstInvalidInput = container.querySelector('#custPincode');
            isValid = false;
        } else if (!/^\d{6}$/.test(cleanPin)) {
            showFieldError(container, 'pincode', 'Please enter a valid 6-digit PIN Code (e.g. 110001).');
            if (!firstInvalidInput) firstInvalidInput = container.querySelector('#custPincode');
            isValid = false;
        }

        if (!isValid) {
            if (firstInvalidInput) {
                firstInvalidInput.focus();
                firstInvalidInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return null;
        }

        return {
            fullName: values.fullName,
            mobileNumber: cleanMobile,
            address: values.address,
            city: values.city,
            state: values.state,
            pincode: cleanPin,
            notes: values.notes
        };
    }

    /**
     * Global delegated event listeners for the cart container
     */
    let isEventDelegationBound = false;
    function setupCartDelegatedListeners(root) {
        if (isEventDelegationBound || !root) return;
        isEventDelegationBound = true;

        // Auto-save form values and clear error on input
        root.addEventListener('input', function (e) {
            const form = root.querySelector('#customerDetailsForm');
            if (!form) return;

            const values = getFormValues(form);
            if (window.PaloraCart) {
                window.PaloraCart.saveCustomerDetails(values);
            }

            // If the active input has an error, clear it as the customer types
            const target = e.target;
            const fieldGroup = target.closest('.form-field');
            if (fieldGroup && fieldGroup.classList.contains('has-error')) {
                fieldGroup.classList.remove('has-error');
                const errEl = fieldGroup.querySelector('.field-error-text');
                if (errEl) errEl.textContent = '';
            }
        });

        // Also handle select change
        root.addEventListener('change', function (e) {
            const form = root.querySelector('#customerDetailsForm');
            if (!form) return;

            const values = getFormValues(form);
            if (window.PaloraCart) {
                window.PaloraCart.saveCustomerDetails(values);
            }

            const target = e.target;
            const fieldGroup = target.closest('.form-field');
            if (fieldGroup && fieldGroup.classList.contains('has-error')) {
                fieldGroup.classList.remove('has-error');
                const errEl = fieldGroup.querySelector('.field-error-text');
                if (errEl) errEl.textContent = '';
            }
        });

        // Form Submission (WhatsApp Order)
        root.addEventListener('submit', function (e) {
            if (e.target.id === 'customerDetailsForm') {
                e.preventDefault();
                handleWhatsAppSubmit(root);
            }
        });

        // Click actions
        root.addEventListener('click', function (e) {
            // 1. Proceed to Customer Details button
            const proceedBtn = e.target.closest('#btnProceedToCustomerDetails');
            if (proceedBtn) {
                e.preventDefault();
                const cart = window.PaloraCart ? window.PaloraCart.getCart() : [];
                if (!cart || cart.length === 0) {
                    alert('Your cart is empty. Please add items to proceed.');
                    return;
                }
                currentStep = 'checkout';
                renderCartPage();
                window.scrollTo({ top: 120, behavior: 'smooth' });
                return;
            }

            // 2. Back to Cart buttons (from Form or Review Sidebar or Stepper)
            const backBtn = e.target.closest('#btnBackToCart, #btnEditCartFromReview, [data-nav-step="cart"]');
            if (backBtn) {
                e.preventDefault();
                // Save current form inputs before returning
                const form = root.querySelector('#customerDetailsForm');
                if (form && window.PaloraCart) {
                    const values = getFormValues(form);
                    window.PaloraCart.saveCustomerDetails(values);
                }
                currentStep = 'cart';
                renderCartPage();
                window.scrollTo({ top: 120, behavior: 'smooth' });
                return;
            }

            // 3. Send Order on WhatsApp Button
            const submitWaBtn = e.target.closest('#btnSendOrderWhatsApp');
            if (submitWaBtn) {
                e.preventDefault();
                handleWhatsAppSubmit(root);
                return;
            }

            // 3a. Direct Download PDF from Step 2 Checkout Form
            const directPdfBtn = e.target.closest('#btnDirectDownloadPDF');
            if (directPdfBtn) {
                e.preventDefault();
                const form = root.querySelector('#customerDetailsForm');
                if (form) {
                    const values = getFormValues(form);
                    if (window.PaloraCart) {
                        window.PaloraCart.saveCustomerDetails(values);
                    }
                }
                if (window.PaloraPDFOrder && typeof window.PaloraPDFOrder.downloadPDF === 'function') {
                    window.PaloraPDFOrder.downloadPDF();
                }
                return;
            }

            // 3b. Preview / Download Cart PDF from Step 1 Summary
            const previewPdfBtn = e.target.closest('#btnCartPreviewPDF');
            if (previewPdfBtn) {
                e.preventDefault();
                if (window.PaloraPDFOrder) {
                    if (typeof window.PaloraPDFOrder.showCustomerOrderSheetModal === 'function') {
                        window.PaloraPDFOrder.showCustomerOrderSheetModal();
                    } else {
                        window.PaloraPDFOrder.downloadPDF();
                    }
                }
                return;
            }

            // 4. Remove Item button
            const removeBtn = e.target.closest('.btn-remove-item');
            if (removeBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = removeBtn.getAttribute('data-remove-id');
                if (id && window.PaloraCart) {
                    window.PaloraCart.removeFromCart(id);
                    window.PaloraCart.showToast('Item removed from cart');
                    renderCartPage();
                }
                return;
            }

            // 5. Quantity Plus / Minus
            const qtyBtn = e.target.closest('.cart-qty-btn');
            if (qtyBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = qtyBtn.getAttribute('data-id');
                const action = qtyBtn.getAttribute('data-action');
                if (!id || !window.PaloraCart) return;

                const cart = window.PaloraCart.getCart();
                const item = cart.find(function (p) { return p.id === id; });
                if (!item) return;

                let currentQty = parseInt(item.quantity, 10) || 1;
                if (action === 'plus') {
                    currentQty += 1;
                    window.PaloraCart.updateQuantity(id, currentQty);
                } else if (action === 'minus') {
                    currentQty -= 1;
                    if (currentQty <= 0) {
                        window.PaloraCart.removeFromCart(id);
                        window.PaloraCart.showToast('Item removed from cart');
                    } else {
                        window.PaloraCart.updateQuantity(id, currentQty);
                    }
                }
                renderCartPage();
                return;
            }

            // 6. Clear All Button
            const clearBtn = e.target.closest('#btnClearCartTop');
            if (clearBtn) {
                e.preventDefault();
                if (confirm('Are you sure you want to clear all items from your cart?')) {
                    if (window.PaloraCart) {
                        window.PaloraCart.clearCart();
                        window.PaloraCart.showToast('Cart cleared');
                        renderCartPage();
                    }
                }
                return;
            }

            // 7. Category Filter Tab
            const catTab = e.target.closest('.cart-cat-tab');
            if (catTab) {
                e.preventDefault();
                const targetFilter = catTab.getAttribute('data-cat-filter');
                currentCategoryFilter = targetFilter;

                root.querySelectorAll('.cart-cat-tab').forEach(function (t) {
                    const isSelected = t.getAttribute('data-cat-filter') === targetFilter;
                    t.classList.toggle('active', isSelected);
                    t.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                });

                root.querySelectorAll('.cart-category-group-section').forEach(function (sec) {
                    const secCat = sec.getAttribute('data-cat-section');
                    if (targetFilter === 'all' || targetFilter === secCat) {
                        sec.style.display = '';
                    } else {
                        sec.style.display = 'none';
                    }
                });
                return;
            }

            // 8. Seed / Reset Category Cart Button (Empty State or Banner)
            const seedBtn = e.target.closest('#btnSeedCategoryCartEmpty, #btnReseedCategoryCart');
            if (seedBtn) {
                e.preventDefault();
                if (window.PaloraCart) {
                    window.PaloraCart.seedCategoryCart(true);
                    currentCategoryFilter = 'all';
                    window.PaloraCart.showToast('✓ Placed curated items into your cart according to categories');
                    renderCartPage();
                }
                return;
            }
        });
    }

    /**
     * Form submission handler: validate details, generate A4 PDF Order Sheet,
     * save record, show confirmation modal, and launch WhatsApp
     */
    function handleWhatsAppSubmit(container) {
        const validatedDetails = validateCustomerForm(container);
        if (!validatedDetails) {
            // Form is invalid; error messages are rendered beside the fields
            return;
        }

        if (!window.PaloraCart) {
            alert('Cart engine is loading. Please try again.');
            return;
        }

        const cart = window.PaloraCart.getCart();
        if (!cart || cart.length === 0) {
            alert('Your cart is empty. Please add items to proceed.');
            currentStep = 'cart';
            renderCartPage();
            return;
        }

        // Save validated details to localStorage so they are permanently preserved
        window.PaloraCart.saveCustomerDetails(validatedDetails);

        // Disable submit button temporarily to prevent duplicate orders from rapid clicking
        const submitBtn = container.querySelector('#btnSendOrderWhatsApp');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            submitBtn.style.pointerEvents = 'none';
        }

        try {
            let orderRecord = null;
            let orderResult = null;

            // 1. Generate real printable business PDF and save order record
            if (window.PaloraPDFOrder && typeof window.PaloraPDFOrder.createAndSaveOrder === 'function') {
                try {
                    orderResult = window.PaloraPDFOrder.createAndSaveOrder(validatedDetails, cart);
                    orderRecord = orderResult.orderRecord;
                } catch (pdfErr) {
                    console.error('PaloraPDFOrder: Error generating PDF Order Sheet', pdfErr);
                }
            }

            // Fallback record if PDF module is not ready
            if (!orderRecord) {
                const now = new Date();
                const random = Math.floor(1000 + Math.random() * 9000);
                const fallbackId = `PH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${random}`;
                orderRecord = {
                    orderId: fallbackId,
                    formattedDate: now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) + ' IST',
                    customer: validatedDetails,
                    items: cart,
                    status: 'Pending Confirmation'
                };
            }

            // 2. Generate pre-filled WhatsApp Order URL with matching inquiry reference
            const waUrl = window.PaloraCart.getWhatsAppOrderUrl(validatedDetails, orderRecord);

            // 3. Automatically trigger instant download of the PDF order sheet
            if (orderResult && orderResult.pdfResult && orderResult.pdfResult.doc) {
                try {
                    orderResult.pdfResult.doc.save(orderResult.pdfResult.fileName);
                } catch (saveErr) {
                    console.warn('PaloraPDFOrder: Auto-save triggered download error, available via modal', saveErr);
                }
            }

            // 4. Show the rich Order Confirmation Modal with download, print & WhatsApp actions
            if (window.PaloraPDFOrder && typeof window.PaloraPDFOrder.showOrderConfirmationModal === 'function') {
                window.PaloraPDFOrder.showOrderConfirmationModal(orderRecord, waUrl);
            }

            // 5. Open WhatsApp in a new tab with pre-filled message
            if (waUrl) {
                window.open(waUrl, '_blank');
            }

            // 6. Dispatch business owner notifications (desktop browser alert & webhook)
            if (window.PaloraPDFOrder && typeof window.PaloraPDFOrder.notifyBusinessOwner === 'function') {
                try {
                    window.PaloraPDFOrder.notifyBusinessOwner(orderRecord);
                } catch (notifErr) {
                    console.warn('PaloraPDFOrder: Business notification error', notifErr);
                }
            }

            window.PaloraCart.showToast(`✓ Order Inquiry #${orderRecord.orderId} generated & opening WhatsApp!`);

        } catch (err) {
            console.error('PaloraHomes: Order submission error', err);
            alert('An error occurred while preparing your PDF Order Sheet. Please click Retry.');
        } finally {
            // Re-enable button after slight delay
            if (submitBtn) {
                setTimeout(function () {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '';
                    submitBtn.style.pointerEvents = '';
                }, 1800);
            }
        }
    }

    // Initial render & event bindings
    document.addEventListener('DOMContentLoaded', function () {
        renderCartPage();

        // Mobile navigation toggle
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const navLinks = document.querySelector('.nav-links');
        if (mobileMenuBtn && navLinks) {
            mobileMenuBtn.addEventListener('click', function () {
                navLinks.classList.toggle('mobile-open');
                mobileMenuBtn.classList.toggle('active');
            });
        }

        // PDF Order Sheet & Admin Inquiries Trigger
        const btnOpenHistory = document.getElementById('btnOpenOrdersHistory');
        if (btnOpenHistory) {
            btnOpenHistory.addEventListener('click', function (e) {
                e.preventDefault();
                if (window.PaloraPDFOrder) {
                    if (typeof window.PaloraPDFOrder.isAdminAuthenticated === 'function' && window.PaloraPDFOrder.isAdminAuthenticated()) {
                        window.PaloraPDFOrder.showOrdersHistoryModal();
                    } else if (typeof window.PaloraPDFOrder.showCustomerOrderSheetModal === 'function') {
                        window.PaloraPDFOrder.showCustomerOrderSheetModal();
                    } else {
                        window.PaloraPDFOrder.downloadPDF();
                    }
                }
            });
        }

        // Direct URL parameter query ?view=orders or ?admin=orders
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('view') === 'orders' || urlParams.get('admin') === 'orders') {
            setTimeout(function () {
                if (window.PaloraPDFOrder && typeof window.PaloraPDFOrder.showOrdersHistoryModal === 'function') {
                    window.PaloraPDFOrder.showOrdersHistoryModal();
                }
            }, 300);
        }
    });

    // Listen to external cart updates (e.g. from drawer or other actions)
    window.addEventListener('palora:cart-updated', function () {
        renderCartPage();
    });

    // Global step navigation helper
    window.PaloraCartGoToStep = function (step) {
        currentStep = step;
        renderCartPage();
        window.scrollTo({ top: 120, behavior: 'smooth' });
    };

})();
