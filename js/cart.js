/**
 * Palora Homes - Unified Shopping Cart & WhatsApp Order Engine
 * Manages cart state in localStorage ('palora_cart') across all pages
 */

(function (window) {
    'use strict';

    const STORAGE_KEY = 'palora_cart';

    const PaloraCart = {
        /**
         * Get cart array from localStorage
         * @returns {Array} Array of cart item objects
         */
        getCart: function () {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                let cart = raw ? JSON.parse(raw) : [];
                if (Array.isArray(cart)) {
                    // Filter out deprecated/removed products
                    const cleaned = cart.filter(function (item) {
                        return item && item.id !== 'key-holder-1';
                    });
                    if (cleaned.length !== cart.length) {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
                    }
                    cart = cleaned;
                }
                return cart;
            } catch (err) {
                console.error('PaloraCart: Failed to parse cart from localStorage', err);
                return [];
            }
        },

        /**
         * Save cart array to localStorage and notify UI
         * @param {Array} cart
         */
        saveCart: function (cart) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
                this.updateBadges();
                window.dispatchEvent(new CustomEvent('palora:cart-updated', { detail: { cart: cart } }));
                this.syncCartActivity(cart);
            } catch (err) {
                console.error('PaloraCart: Failed to save cart to localStorage', err);
            }
        },

        /**
         * Anonymous session identifier for guest cart tracking
         * @returns {string}
         */
        getSessionId: function () {
            try {
                let sid = localStorage.getItem('palora_guest_session_id');
                if (!sid) {
                    sid = 'guest_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
                    localStorage.setItem('palora_guest_session_id', sid);
                }
                return sid;
            } catch (e) {
                return 'guest_anon';
            }
        },

        /**
         * Debounced real-time cart tracking synchronization to Supabase Cloud
         * @param {Array} cart
         */
        syncCartActivity: function (cart) {
            if (typeof window === 'undefined' || !window.PaloraSupabase || typeof window.PaloraSupabase.syncCartActivity !== 'function') {
                return;
            }

            try {
                if (this._syncDebounceTimer) {
                    clearTimeout(this._syncDebounceTimer);
                }
                const self = this;
                this._syncDebounceTimer = setTimeout(function () {
                    const sid = self.getSessionId();
                    const cust = self.getCustomerDetails();
                    window.PaloraSupabase.syncCartActivity(sid, cart || [], cust);
                }, 800);
            } catch (e) {
                // Silently ignore tracking sync errors
            }
        },

        /**
         * Get total item quantity count
         * @returns {number}
         */
        getTotalCount: function () {
            const cart = this.getCart();
            return cart.reduce(function (sum, item) {
                return sum + (parseInt(item.quantity, 10) || 1);
            }, 0);
        },

        /**
         * Calculate subtotal (if prices available)
         * @returns {{ hasPrices: boolean, total: number }}
         */
        getTotals: function () {
            const cart = this.getCart();
            let total = 0;
            let hasPrices = false;

            cart.forEach(function (item) {
                const qty = parseInt(item.quantity, 10) || 1;
                if (typeof item.price === 'number' && !isNaN(item.price)) {
                    hasPrices = true;
                    total += item.price * qty;
                }
            });

            return { hasPrices: hasPrices, total: total };
        },

        /**
         * Update all header/nav badge counters
         */
        updateBadges: function () {
            const count = this.getTotalCount();
            const badges = document.querySelectorAll('#bagCount, .bag-count');
            badges.forEach(function (el) {
                el.textContent = count;
                el.classList.remove('badge-pulse');
                void el.offsetWidth; // Trigger reflow for animation
                el.classList.add('badge-pulse');
            });
        },

        /**
         * Add a product to the cart by its ID
         * @param {string} productId
         * @param {number} quantity
         * @returns {Object|null}
         */
        addToCart: function (productId, quantity) {
            const config = window.PALORA_CONFIG || {};
            const catalog = config.upcomingCollections || [];
            const product = catalog.find(function (p) {
                return p.id === productId;
            });

            if (!product) {
                console.warn('PaloraCart: Product not found with id', productId);
                return null;
            }

            const cart = this.getCart();
            const qtyToAdd = Math.max(1, parseInt(quantity, 10) || 1);
            const existing = cart.find(function (item) {
                return item.id === productId;
            });

            if (existing) {
                existing.quantity = (parseInt(existing.quantity, 10) || 1) + qtyToAdd;
            } else {
                cart.push({
                    id: product.id,
                    title: product.title,
                    subtitle: product.subtitle || '',
                    category: product.category || 'decor',
                    categoryName: product.categoryName || 'Handcrafted',
                    specs: product.specs || '',
                    image: product.image,
                    price: typeof product.price === 'number' ? product.price : null,
                    quantity: qtyToAdd
                });
            }

            this.saveCart(cart);

            return {
                product: product,
                quantityAdded: qtyToAdd,
                totalCount: this.getTotalCount()
            };
        },

        /**
         * Update item quantity (removes if <= 0)
         * @param {string} productId
         * @param {number} newQty
         */
        updateQuantity: function (productId, newQty) {
            const qty = parseInt(newQty, 10);
            if (isNaN(qty) || qty <= 0) {
                this.removeFromCart(productId);
                return;
            }

            const cart = this.getCart();
            const item = cart.find(function (p) {
                return p.id === productId;
            });

            if (item) {
                item.quantity = qty;
                this.saveCart(cart);
            }
        },

        /**
         * Remove an item from the cart
         * @param {string} productId
         */
        removeFromCart: function (productId) {
            let cart = this.getCart();
            if (!productId) {
                this.clearCart();
                return;
            }
            cart = cart.filter(function (p) {
                return p.id !== productId;
            });
            this.saveCart(cart);
        },

        /**
         * Clear all items in cart
         */
        clearCart: function () {
            this.saveCart([]);
        },

        /**
         * Get cart items grouped by category
         * @returns {Array<{ category: string, categoryName: string, icon: string, items: Array, totalQty: number }>}
         */
        getCartGroupedByCategory: function () {
            const cart = this.getCart();
            const config = window.PALORA_CONFIG || {};
            const meta = config.categoriesMeta || {};

            const order = ['wall-clock', 'key-holder', 'night-lamp', 'wall-decor', 'wall-hanging', 'car-dashboard'];
            const groupsMap = {};

            cart.forEach(function (item) {
                const catKey = item.category || 'other';
                if (!groupsMap[catKey]) {
                    const catMeta = meta[catKey] || {};
                    groupsMap[catKey] = {
                        category: catKey,
                        categoryName: catMeta.name || item.categoryName || 'Curated Pieces',
                        plural: catMeta.plural || (catMeta.name ? catMeta.name + 's' : 'Curated Pieces'),
                        icon: catMeta.icon || '📁',
                        items: [],
                        totalQty: 0
                    };
                }
                const qty = parseInt(item.quantity, 10) || 1;
                groupsMap[catKey].items.push(item);
                groupsMap[catKey].totalQty += qty;
            });

            // Return in predetermined order, followed by any others
            const sortedGroups = [];
            order.forEach(function (catKey) {
                if (groupsMap[catKey]) {
                    sortedGroups.push(groupsMap[catKey]);
                    delete groupsMap[catKey];
                }
            });

            Object.keys(groupsMap).forEach(function (catKey) {
                sortedGroups.push(groupsMap[catKey]);
            });

            return sortedGroups;
        },

        /**
         * Seed cart with the 5 curated category items from user specifications
         * @param {boolean} [force=false] If true, clears existing and seeds
         * @returns {number} Count of items seeded
         */
        seedCategoryCart: function (force) {
            const current = this.getCart();
            if (!force && current.length > 0) {
                return current.length;
            }

            const config = window.PALORA_CONFIG || {};
            const catalog = config.upcomingCollections || [];
            const targetIds = config.defaultCategoryCartProductIds || [
                'wall-clock-roman-scalloped-teak',
                'wall-hanging-krishna-mantra',
                'car-dashboard-hanuman-acd007',
                'car-dashboard-indian-flag-cd019',
                'car-dashboard-shrinathji-cd026'
            ];

            const newCart = [];
            targetIds.forEach(function (id) {
                const product = catalog.find(function (p) { return p.id === id; });
                if (product) {
                    newCart.push({
                        id: product.id,
                        title: product.title,
                        subtitle: product.subtitle || '',
                        category: product.category || 'decor',
                        categoryName: product.categoryName || 'Handcrafted',
                        specs: product.specs || '',
                        image: product.image,
                        price: typeof product.price === 'number' ? product.price : null,
                        quantity: 1
                    });
                }
            });

            if (newCart.length > 0) {
                this.saveCart(newCart);
            }

            return newCart.length;
        },

        /**
         * Get saved customer details from localStorage
         * @returns {Object}
         */
        getCustomerDetails: function () {
            try {
                const raw = localStorage.getItem('palora_customer_details');
                const parsed = raw ? JSON.parse(raw) : null;
                return parsed || {
                    fullName: '',
                    mobileNumber: '',
                    address: '',
                    city: '',
                    state: '',
                    pincode: '',
                    notes: ''
                };
            } catch (err) {
                console.error('PaloraCart: Failed to parse customer details', err);
                return {
                    fullName: '',
                    mobileNumber: '',
                    address: '',
                    city: '',
                    state: '',
                    pincode: '',
                    notes: ''
                };
            }
        },

        /**
         * Save customer details to localStorage
         * @param {Object} details
         */
        saveCustomerDetails: function (details) {
            try {
                localStorage.setItem('palora_customer_details', JSON.stringify(details || {}));
                this.syncCartActivity(this.getCart());
            } catch (err) {
                console.error('PaloraCart: Failed to save customer details', err);
            }
        },

        /**
         * Build the pre-filled WhatsApp message & URL containing customer details, order inquiry reference, and items
         * @param {Object} [customerDetails]
         * @param {Object} [orderRecord]
         * @returns {string|null}
         */
        getWhatsAppOrderUrl: function (customerDetails, orderRecord) {
            const cart = this.getCart();
            if (!cart || cart.length === 0) return null;

            const config = window.PALORA_CONFIG || {};
            const phone = config.whatsappNumber || '919319862081';
            const details = customerDetails || this.getCustomerDetails();

            // Order reference metadata
            const orderId = (orderRecord && orderRecord.orderId) ? orderRecord.orderId : (localStorage.getItem('palora_last_order_id') || 'PH-INQ-PENDING');
            const orderDate = (orderRecord && orderRecord.formattedDate) ? orderRecord.formattedDate : (new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) + ' IST');

            let totalQty = 0;
            let totalPrice = 0;
            let hasPrices = false;
            let totalPieces = 0;

            cart.forEach(function (item) {
                const qty = parseInt(item.quantity, 10) || 1;
                totalQty += qty;

                // Pack multiplier check for pairs / sets
                let multiplier = 1;
                const specs = item.specs || item.subtitle || '';
                if (/pair|\b2\s*pcs\b|set of 2/i.test(specs) || /pair/i.test(item.title || '')) {
                    multiplier = 2;
                } else if (/set of (\d+)/i.test(specs)) {
                    const m = specs.match(/set of (\d+)/i);
                    if (m && m[1]) multiplier = parseInt(m[1], 10) || 1;
                }
                totalPieces += (qty * multiplier);

                if (typeof item.price === 'number' && !isNaN(item.price)) {
                    hasPrices = true;
                    totalPrice += item.price * qty;
                }
            });

            const fullName = (details.fullName || '').trim() || 'Not specified';
            const mobileNumber = (details.mobileNumber || '').trim() || 'Not specified';
            const address = (details.address || '').trim() || 'Not specified';
            const city = (details.city || '').trim() || 'Not specified';
            const state = (details.state || '').trim() || 'Not specified';
            const pincode = (details.pincode || '').trim() || 'Not specified';
            const notes = (details.notes || '').trim();

            let msg = `*PALORA HOMES — CUSTOMER ORDER INQUIRY*\n`;
            msg += `📄 *Order Inquiry No:* ${orderId}\n`;
            msg += `📅 *Date & Time:* ${orderDate}\n`;
            msg += `📌 *Status:* Order Inquiry — Pending Confirmation\n\n`;

            msg += `*CUSTOMER & DELIVERY DETAILS:*\n`;
            msg += `• *Full Name:* ${fullName}\n`;
            msg += `• *Mobile:* +91 ${mobileNumber}\n`;
            msg += `• *Delivery Address:* ${address}\n`;
            msg += `• *City, State, PIN:* ${city}, ${state} - ${pincode}\n`;
            if (notes && notes.length > 0) {
                msg += `• *Order Notes:* ${notes}\n`;
            }
            msg += `\n*ORDERED PRODUCT ITEMS:*\n`;

            cart.forEach(function (item, idx) {
                const qty = parseInt(item.quantity, 10) || 1;
                // Sanitize model code if helper is loaded
                let cleanTitle = item.title;
                if (window.PaloraPDFOrder && typeof window.PaloraPDFOrder.sanitizeProductName === 'function') {
                    cleanTitle = window.PaloraPDFOrder.sanitizeProductName(item.title);
                } else {
                    cleanTitle = cleanTitle.replace(/\s*\([A-Za-z0-9\-_]{3,10}\)\s*/gi, ' ').trim();
                }

                msg += `${idx + 1}. *${cleanTitle}*\n`;
                if (item.categoryName) {
                    msg += `   • Category: ${item.categoryName}\n`;
                }
                if (item.specs) {
                    msg += `   • Specs: ${item.specs}\n`;
                }
                msg += `   • Quantity: ${qty} ${qty > 1 ? 'packs/units' : 'pack/unit'}\n`;

                if (typeof item.price === 'number' && !isNaN(item.price)) {
                    msg += `   • Unit Price: ₹${item.price.toLocaleString('en-IN')}\n`;
                    msg += `   • Subtotal: ₹${(item.price * qty).toLocaleString('en-IN')}\n`;
                } else {
                    msg += `   • Price: Inquiry Quote (Confirmation Pending)\n`;
                }
            });

            msg += `\n*ORDER SUMMARY:*\n`;
            msg += `• Total Distinct Products: ${cart.length}\n`;
            msg += `• Total Ordered Units: ${totalQty}\n`;
            msg += `• Total Individual Pieces: ${totalPieces} pcs\n`;

            if (hasPrices) {
                msg += `• Subtotal: ₹${totalPrice.toLocaleString('en-IN')}\n`;
                msg += `• Final Total: Price Confirmation Pending\n`;
            } else {
                msg += `• Subtotal: Inquiry Quote — Price Confirmation Pending\n`;
            }
            msg += `• Shipping Charges: To be confirmed on WhatsApp\n`;
            msg += `• Pricing Status: Inquiry Quote — Price Confirmation Pending\n\n`;

            msg += `Official A4 PDF Order Inquiry Sheet #${orderId} generated & saved on device.\n`;
            msg += `Please confirm product availability, shipping charges, and final payment details.`;

            return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        },

        /**
         * Helper to show a sleek notification toast
         * @param {string} message
         * @param {string} [linkText]
         * @param {string} [linkHref]
         */
        showToast: function (message, linkText, linkHref) {
            let container = document.getElementById('paloraToastContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'paloraToastContainer';
                container.className = 'palora-toast-container';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            toast.className = 'palora-toast';
            toast.setAttribute('role', 'alert');

            let contentHtml = `<span class="toast-message">${message}</span>`;
            if (linkText && linkHref) {
                contentHtml += `<a href="${linkHref}" class="toast-action-btn">${linkText}</a>`;
            }

            toast.innerHTML = contentHtml;
            container.appendChild(toast);

            // Animate in
            requestAnimationFrame(function () {
                toast.classList.add('visible');
            });

            // Auto dismiss after 3.5s
            setTimeout(function () {
                toast.classList.remove('visible');
                setTimeout(function () {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 3500);
        }
    };

    // Auto-update badges when DOM is ready
    if (typeof document !== 'undefined') {
        function initCartState() {
            // Keep palora_cart_user_category_v2 flag preserved without automatically seeding any products
            try {
                if (!localStorage.getItem('palora_cart_user_category_v2')) {
                    localStorage.setItem('palora_cart_user_category_v2', 'true');
                }
            } catch (e) {
                // Ignore storage access errors
            }
            PaloraCart.updateBadges();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCartState);
        } else {
            initCartState();
        }
    }

    window.PaloraCart = PaloraCart;

})(window);
