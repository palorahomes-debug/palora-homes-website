/**
 * Palora Homes - Official PDF Order Inquiry Sheet Generator & Order Manager
 * Generates printable A4 business PDF sheets for customer order inquiries
 * Powered by jsPDF & jsPDF-AutoTable with local offline resilience
 */

(function (window) {
    'use strict';

    // Global in-memory cache for cross-device orders retrieved from Supabase
    if (!window._paloraCloudOrdersCache) {
        window._paloraCloudOrdersCache = {};
    }

    const PaloraPDFOrder = {
        /**
         * Generate a unique, professional Order Inquiry Number
         * Format: PH-YYYYMMDD-XXXX (e.g. PH-20261024-8492)
         * @returns {string}
         */
        generateOrderInquiryId: function () {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const random = Math.floor(1000 + Math.random() * 9000);
            return `PH-${year}${month}${day}-${random}`;
        },

        /**
         * Clean customer-facing product name (strips model numbers / SKU codes)
         * e.g. "Lord Hanuman Acrylic Frame (ACD007)" -> "Lord Hanuman Acrylic Frame"
         * @param {string} title
         * @returns {string}
         */
        sanitizeProductName: function (title) {
            if (!title) return 'Palora Home Decor Piece';
            let clean = String(title);
            // Remove parenthetical model codes e.g. (ACD007), (CD019), (kh082), (kh083), (wwc102), (wh006)
            clean = clean.replace(/\s*\([A-Za-z0-9\-_]{3,10}\)\s*/gi, ' ');
            // Remove standalone model codes e.g. "ACD007", "CD019", "KH082"
            clean = clean.replace(/\s+\b(?:ACD|CD|KH|WWC|WH)\d{2,4}\b/gi, '');
            // Clean extra spaces and quotes
            return clean.replace(/\s+/g, ' ').trim();
        },

        /**
         * Parse product specifications into structured Size, Colour/Finish, and Pack quantities
         * @param {Object} item
         * @returns {Object}
         */
        parseProductDetails: function (item) {
            const rawSpecs = item.specs || item.subtitle || '';
            let size = 'Not specified';
            let finish = 'Not specified';
            let packMultiplier = 1;
            let packLabel = 'Single Piece';

            // Check if sold as a pair or set
            if (/pair|\b2\s*pcs\b|set of 2/i.test(rawSpecs) || /pair/i.test(item.title || '')) {
                packMultiplier = 2;
                packLabel = 'Pair (2 Pcs / pack)';
            } else if (/set of (\d+)/i.test(rawSpecs)) {
                const match = rawSpecs.match(/set of (\d+)/i);
                if (match && match[1]) {
                    packMultiplier = parseInt(match[1], 10) || 1;
                    packLabel = `Set of ${packMultiplier}`;
                }
            }

            // Extract dimension patterns e.g. 14" Diameter, 4" x 3", 16" x 6", 6" x 8"
            const dimMatch = rawSpecs.match(/\b\d+(?:\.\d+)?["″]\s*(?:x\s*\d+(?:\.\d+)?["″])?(?:\s*Diameter)?/i) ||
                             rawSpecs.match(/\b\d+\s*x\s*\d+\s*(?:inch|inches|cm)?\b/i);
            if (dimMatch) {
                size = dimMatch[0].trim();
            } else if (/multi-tier/i.test(rawSpecs)) {
                size = 'Multi-Tier Wooden Slats';
            } else if (/wall plug-in/i.test(rawSpecs)) {
                size = 'Wall Socket Plug-in';
            } else if (/tabletop/i.test(rawSpecs)) {
                size = 'Tabletop Stand';
            }

            // Extract finish / materials
            const parts = rawSpecs.split(/[•,;|]+/).map(s => s.trim()).filter(Boolean);
            const finishCandidates = parts.filter(p => 
                !p.match(/["″]/) && 
                !p.match(/\b\d+\s*x\s*\d+\b/i) &&
                !p.match(/\b(?:kh|acd|wwc|wh|cd)\d+/i) &&
                !p.match(/\b(?:single|pair|pcs|piece)\b/i)
            );
            if (finishCandidates.length > 0) {
                finish = finishCandidates[0].replace(/\([A-Za-z0-9\-_]+\)/g, '').trim();
            }

            const orderQty = parseInt(item.quantity, 10) || 1;
            const totalPieces = orderQty * packMultiplier;

            return {
                cleanTitle: this.sanitizeProductName(item.title),
                categoryName: item.categoryName || 'Home Decor',
                size: size || 'Not specified',
                finish: finish || 'Not specified',
                packMultiplier: packMultiplier,
                packLabel: packLabel,
                orderQty: orderQty,
                totalPieces: totalPieces,
                unitPrice: (typeof item.price === 'number' && !isNaN(item.price)) ? item.price : null
            };
        },

        /**
         * Save an order inquiry to localStorage & memory cache
         * Strips heavy base64 data URIs to prevent browser quota crashes
         * @param {Object} orderRecord
         */
        saveOrderInquiry: function (orderRecord) {
            try {
                if (!orderRecord || !orderRecord.orderId) return;

                // Cache in memory for instant session access
                if (!window._paloraOrderMemoryCache) window._paloraOrderMemoryCache = {};
                window._paloraOrderMemoryCache[orderRecord.orderId] = orderRecord;
                window._paloraLastOrderRecord = orderRecord;

                const STORAGE_KEY = 'palora_order_inquiries';
                const raw = localStorage.getItem(STORAGE_KEY);
                let list = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(list)) list = [];

                // Remove duplicate if same order ID exists
                list = list.filter(o => o.orderId !== orderRecord.orderId);

                // Strip heavy base64 PDF data URI before persisting to localStorage
                const lightRecord = Object.assign({}, orderRecord);
                delete lightRecord.pdfDataUri;

                // Prepend latest order
                list.unshift(lightRecord);

                // Keep up to 50 latest inquiries
                if (list.length > 50) list = list.slice(0, 50);

                localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
                localStorage.setItem('palora_last_order_id', orderRecord.orderId);
            } catch (err) {
                console.error('PaloraPDFOrder: Failed to save order inquiry record', err);
            }
        },

        /**
         * Retrieve all saved order inquiries
         * @returns {Array}
         */
        getAllOrders: function () {
            try {
                const raw = localStorage.getItem('palora_order_inquiries');
                return raw ? JSON.parse(raw) : [];
            } catch (err) {
                return [];
            }
        },

        /**
         * Retrieve a specific order by ID (checks memory cache, localStorage, then cloud cache)
         * @param {string} orderId
         * @returns {Object|null}
         */
        getOrderById: function (orderId) {
            if (!orderId) return null;
            const cleanId = String(orderId).trim().toUpperCase();

            // 1. Check in-memory session cache first
            if (window._paloraOrderMemoryCache && window._paloraOrderMemoryCache[cleanId]) {
                return window._paloraOrderMemoryCache[cleanId];
            }
            if (window._paloraLastOrderRecord && (window._paloraLastOrderRecord.orderId || '').toUpperCase() === cleanId) {
                return window._paloraLastOrderRecord;
            }

            // 2. Check localStorage
            const list = this.getAllOrders();
            const found = list.find(o => 
                (o.orderId && o.orderId.toUpperCase() === cleanId) || 
                (o.id && String(o.id) === String(orderId))
            );
            if (found) return found;

            // 3. Check cloud cache
            if (window._paloraCloudOrdersCache && window._paloraCloudOrdersCache[cleanId]) {
                return window._paloraCloudOrdersCache[cleanId];
            }
            return null;
        },

        /**
         * Update an order status (e.g. Confirmed, In Packaging, Dispatched, Delivered, Cancelled)
         * Automatically regenerates the PDF to reflect the updated status
         * Updates localStorage and synchronizes with Supabase cloud in background
         * @param {string} orderId
         * @param {string} newStatus
         * @param {string} [adminNotes]
         * @returns {Object|null}
         */
        updateOrderStatus: function (orderId, newStatus, adminNotes) {
            try {
                const STORAGE_KEY = 'palora_order_inquiries';
                const list = this.getAllOrders();
                let order = list.find(o => o.orderId === orderId);

                // If not in localStorage, look in cloud cache
                if (!order && window._paloraCloudOrdersCache && window._paloraCloudOrdersCache[orderId]) {
                    order = window._paloraCloudOrdersCache[orderId];
                }

                if (!order) return null;

                order.status = newStatus;
                if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
                order.statusHistory.push({
                    status: newStatus,
                    timestamp: new Date().toISOString(),
                    formattedDate: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) + ' IST',
                    notes: adminNotes || ''
                });

                if (typeof adminNotes === 'string') {
                    order.adminNotes = adminNotes;
                }

                // Regenerate PDF with updated status
                try {
                    const regenerated = this.generatePDF(order);
                    order.pdfDataUri = regenerated.pdfDataUri;
                    order.fileName = regenerated.fileName;
                } catch (pdfErr) {
                    console.warn('PaloraPDFOrder: Failed to regenerate PDF on status update', pdfErr);
                }

                // If in localStorage list, persist update
                if (list.some(o => o.orderId === orderId)) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
                }

                // Update memory cache
                if (window._paloraCloudOrdersCache) {
                    window._paloraCloudOrdersCache[orderId] = order;
                }

                // Dispatch global event so UI components refresh reactively
                window.dispatchEvent(new CustomEvent('palora:order-updated', {
                    detail: { orderId: orderId, status: newStatus, order: order }
                }));

                // Asynchronously sync update to Supabase database
                this.updateCloudOrderStatus(orderId, newStatus, adminNotes).catch(function (err) {
                    console.info('PaloraPDFOrder: Cloud status sync skipped (running locally or not configured):', err.message);
                });

                return order;
            } catch (err) {
                console.error('PaloraPDFOrder: Failed to update order status', err);
                return null;
            }
        },

        /**
         * Search and filter order inquiries by Order ID, Mobile Number, Customer Name, or City
         * @param {string} [query]
         * @param {string} [statusFilter='all']
         * @returns {Array}
         */
        searchOrders: function (query, statusFilter) {
            const list = this.getAllOrders();
            const q = (query || '').trim().toLowerCase();
            const cleanDigits = q.replace(/\D/g, '');
            const filter = (statusFilter || 'all').trim().toLowerCase();

            return list.filter(function (order) {
                // 1. Status Filter
                if (filter && filter !== 'all') {
                    const s = (order.status || 'pending confirmation').toLowerCase();
                    if (s !== filter) return false;
                }

                if (!q) return true;

                // 2. Match Order Inquiry Number
                if (order.orderId && order.orderId.toLowerCase().includes(q)) return true;

                // 3. Match Customer Mobile Number (with or without +91)
                const cust = order.customer || {};
                const mobDigits = (cust.mobileNumber || '').replace(/\D/g, '');
                if (cleanDigits.length >= 3 && mobDigits.includes(cleanDigits)) return true;

                // 4. Match Customer Full Name
                if (cust.fullName && cust.fullName.toLowerCase().includes(q)) return true;

                // 5. Match Delivery City or PIN Code
                if (cust.city && cust.city.toLowerCase().includes(q)) return true;
                if (cust.pincode && cust.pincode.includes(q)) return true;

                // 6. Match Product Titles or Categories
                if (Array.isArray(order.items)) {
                    const hasProductMatch = order.items.some(function (it) {
                        return (it.title && it.title.toLowerCase().includes(q)) ||
                               (it.categoryName && it.categoryName.toLowerCase().includes(q));
                    });
                    if (hasProductMatch) return true;
                }

                return false;
            });
        },

        /**
         * Delete an order record by ID (removes from localStorage and Supabase)
         * @param {string} orderId
         * @returns {boolean}
         */
        deleteOrder: function (orderId) {
            try {
                const STORAGE_KEY = 'palora_order_inquiries';
                let list = this.getAllOrders();
                list = list.filter(o => o.orderId !== orderId);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

                if (window._paloraCloudOrdersCache) {
                    delete window._paloraCloudOrdersCache[orderId];
                }

                window.dispatchEvent(new CustomEvent('palora:order-deleted', { detail: { orderId: orderId } }));

                // Synchronize deletion with Supabase in background
                this.deleteCloudOrder(orderId).catch(function (err) {
                    console.info('PaloraPDFOrder: Cloud deletion skipped:', err.message);
                });

                return true;
            } catch (err) {
                console.error('PaloraPDFOrder: Failed to delete order', err);
                return false;
            }
        },

        /**
         * Export all order records to CSV for accounting and business reporting
         */
        exportOrdersCSV: function () {
            const orders = this.getAllOrders();
            if (orders.length === 0) {
                alert('No order inquiries recorded yet to export.');
                return;
            }

            const headers = [
                'Order ID',
                'Date & Time',
                'Status',
                'Customer Full Name',
                'Mobile Number',
                'Delivery Address',
                'City',
                'State',
                'PIN Code',
                'Customer Order Notes',
                'Distinct Products',
                'Total Pieces',
                'Subtotal (INR)',
                'Pricing Status'
            ];

            const rows = orders.map(function (o) {
                const cust = o.customer || {};
                const items = o.items || [];
                let totalPieces = 0;
                let subtotal = 0;
                let hasPrices = false;

                items.forEach(function (it) {
                    const q = parseInt(it.quantity, 10) || 1;
                    let mult = 1;
                    const sp = it.specs || '';
                    if (/pair|\b2\s*pcs\b/i.test(sp)) mult = 2;
                    else if (/set of (\d+)/i.test(sp)) {
                        const m = sp.match(/set of (\d+)/i);
                        if (m && m[1]) mult = parseInt(m[1], 10) || 1;
                    }
                    totalPieces += (q * mult);
                    if (typeof it.price === 'number' && !isNaN(it.price)) {
                        hasPrices = true;
                        subtotal += (it.price * q);
                    }
                });

                const escapeCol = function (val) {
                    const str = String(val || '').replace(/"/g, '""');
                    return `"${str}"`;
                };

                return [
                    escapeCol(o.orderId),
                    escapeCol(o.formattedDate),
                    escapeCol(o.status || 'Pending Confirmation'),
                    escapeCol(cust.fullName),
                    escapeCol(cust.mobileNumber),
                    escapeCol(cust.address),
                    escapeCol(cust.city),
                    escapeCol(cust.state),
                    escapeCol(cust.pincode),
                    escapeCol(cust.notes),
                    items.length,
                    totalPieces,
                    hasPrices ? subtotal : 'Quote Pending',
                    hasPrices ? 'Priced' : 'Inquiry Quote'
                ].join(',');
            });

            const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\r\n');
            const encodedUri = encodeURI(csvContent);
            const a = document.createElement('a');
            a.setAttribute('href', encodedUri);
            a.setAttribute('download', `Palora-Homes-Orders-${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        },

        /**
         * Export JSON backup of all order inquiries
         */
        exportOrdersJSON: function () {
            const orders = this.getAllOrders();
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(orders, null, 2));
            const a = document.createElement('a');
            a.setAttribute('href', dataStr);
            a.setAttribute('download', `Palora-Homes-Orders-Backup-${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        },

        /**
         * Notify business owner when a customer order inquiry is submitted
         * Supports desktop browser notification & configurable HTTP POST webhook
         * @param {Object} orderRecord
         * @returns {Object} { browserNotificationSent, webhookDispatched, webhookConfigured }
         */
        notifyBusinessOwner: function (orderRecord) {
            const config = (window.PALORA_CONFIG && window.PALORA_CONFIG.adminConfig) || {};
            const result = {
                browserNotificationSent: false,
                webhookDispatched: false,
                webhookConfigured: Boolean(config.notificationWebhookUrl && config.notificationWebhookUrl.trim())
            };

            const customer = orderRecord.customer || {};
            const items = orderRecord.items || [];
            let totalQty = 0;
            items.forEach(function (it) { totalQty += (parseInt(it.quantity, 10) || 1); });

            // 1. Desktop Browser Notification (if permission granted or requested)
            if (config.enableBrowserNotifications && typeof window.Notification !== 'undefined') {
                if (Notification.permission === 'granted') {
                    try {
                        new Notification('New Palora Homes Order Inquiry!', {
                            body: `#${orderRecord.orderId} from ${customer.fullName || 'Customer'} (${items.length} items, ${totalQty} pcs)\n${customer.city || ''}, ${customer.state || ''}`,
                            icon: 'assets/images/heart-3d-led-lamp.png'
                        });
                        result.browserNotificationSent = true;
                    } catch (err) {
                        console.warn('PaloraPDFOrder: Browser notification failed', err);
                    }
                } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission();
                }
            }

            // 2. Webhook Notification (e.g. Zapier, Make, Slack, Discord, Telegram, or serverless API)
            if (result.webhookConfigured) {
                const webhookPayload = {
                    event: 'order.inquiry.created',
                    brand: 'Palora Homes',
                    orderId: orderRecord.orderId,
                    timestamp: orderRecord.createdAt || new Date().toISOString(),
                    formattedDate: orderRecord.formattedDate,
                    status: orderRecord.status || 'Pending Confirmation',
                    customer: {
                        fullName: customer.fullName,
                        mobileNumber: customer.mobileNumber,
                        deliveryAddress: customer.address,
                        city: customer.city,
                        state: customer.state,
                        pincode: customer.pincode,
                        orderNotes: customer.notes
                    },
                    itemsCount: items.length,
                    totalPieces: totalQty,
                    items: items.map(function (it) {
                        return {
                            id: it.id,
                            title: it.title,
                            category: it.categoryName || it.category,
                            specs: it.specs,
                            quantity: it.quantity,
                            price: it.price
                        };
                    })
                };

                try {
                    fetch(config.notificationWebhookUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(webhookPayload)
                    }).then(function () {
                        console.log('PaloraPDFOrder: Business notification webhook dispatched successfully.');
                    }).catch(function (wErr) {
                        console.warn('PaloraPDFOrder: Webhook dispatch error', wErr);
                    });
                    result.webhookDispatched = true;
                } catch (e) {
                    console.warn('PaloraPDFOrder: Webhook call error', e);
                }
            }

            return result;
        },

        /**
         * Generate a pre-filled WhatsApp link to send the customer a status update
         * @param {string} orderId
         * @param {string} [newStatus]
         * @returns {string|null}
         */
        getWhatsAppStatusUpdateUrl: function (orderId, newStatus) {
            const order = this.getOrderById(orderId);
            if (!order) return null;
            const cust = order.customer || {};
            const mob = (cust.mobileNumber || '').replace(/\D/g, '');
            if (!mob) return null;
            const phone = mob.startsWith('91') ? mob : `91${mob}`;

            const statusText = newStatus || order.status || 'Confirmed';
            let msg = `*PALORA HOMES — ORDER STATUS UPDATE*\n\n`;
            msg += `Dear ${cust.fullName || 'Valued Customer'},\n\n`;
            msg += `Your Palora Homes Order Inquiry *#${orderId}* status has been updated to: *${statusText}*.\n\n`;

            if (statusText === 'Confirmed') {
                msg += `Your order inquiry has been verified and confirmed by our team. We are preparing your artisanal home decor pieces for safe transit.\n\n`;
            } else if (statusText === 'In Packaging') {
                msg += `Your handcrafted items are currently being packed with multi-layer protective bubble & foam wrapping.\n\n`;
            } else if (statusText === 'Dispatched') {
                msg += `Your order has been dispatched for delivery to ${cust.city || 'your address'}!\n\n`;
            } else if (statusText === 'Delivered') {
                msg += `Your order has been marked as delivered. We hope you love your handcrafted Palora decor pieces! Please share your feedback.\n\n`;
            }

            msg += `Official Business Contact: +91 93198 62081\n`;
            msg += `Tagline: Modern Living, Indian Soul`;

            return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        },

        /**
         * Admin Session & Authentication Checks
         */
        isAdminAuthenticated: function () {
            try {
                return sessionStorage.getItem('palora_admin_auth') === 'authenticated';
            } catch (e) {
                return false;
            }
        },

        getAdminPin: function () {
            try {
                return sessionStorage.getItem('palora_admin_pin') || '';
            } catch (e) {
                return '';
            }
        },

        verifyAdminPin: async function (inputPin) {
            const trimmed = String(inputPin).trim();
            if (!trimmed) return false;

            // 1. Check with Netlify serverless function if available
            try {
                const res = await fetch('/api/get-orders?limit=1', {
                    method: 'GET',
                    headers: { 'x-admin-pin': trimmed }
                });
                if (res.status === 200) {
                    sessionStorage.setItem('palora_admin_auth', 'authenticated');
                    sessionStorage.setItem('palora_admin_pin', trimmed);
                    return true;
                } else if (res.status === 401) {
                    return false;
                }
            } catch (e) {
                // Backend not reachable, fall back to local config check
            }

            // 2. Local config fallback for local file opening
            const config = (window.PALORA_CONFIG && window.PALORA_CONFIG.adminConfig) || {};
            const correctPin = config.pin || 'palora2026';
            if (trimmed === String(correctPin).trim()) {
                sessionStorage.setItem('palora_admin_auth', 'authenticated');
                sessionStorage.setItem('palora_admin_pin', trimmed);
                return true;
            }
            return false;
        },

        logoutAdmin: function () {
            sessionStorage.removeItem('palora_admin_auth');
            sessionStorage.removeItem('palora_admin_pin');
        },

        /**
         * Generate a professional printable A4 PDF Order Inquiry Sheet
         * @param {Object} orderData
         * @returns {Object} { doc, pdfBlob, pdfDataUri, orderId, fileName }
         */
        generatePDF: function (orderData) {
            // Check jsPDF availability
            const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
            if (!jsPDFClass) {
                throw new Error('PDF Generation Library (jsPDF) is not loaded.');
            }

            const doc = new jsPDFClass({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const config = window.PALORA_CONFIG || {};
            const orderId = orderData.orderId || this.generateOrderInquiryId();
            const dateStr = orderData.formattedDate || new Date().toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short'
            }) + ' IST';

            const customer = orderData.customer || {};
            const items = orderData.items || [];

            // Robust multi-source customer details normalization
            let storedCust = {};
            try {
                const rawStored = localStorage.getItem('palora_customer_details');
                if (rawStored) storedCust = JSON.parse(rawStored);
            } catch (e) {}

            // Also check live DOM inputs if currently on cart / checkout page
            let domCust = {};
            try {
                const nameEl = document.getElementById('custFullName');
                const mobEl = document.getElementById('custMobile');
                const addrEl = document.getElementById('custAddress');
                const cityEl = document.getElementById('custCity');
                const stateEl = document.getElementById('custState');
                const pinEl = document.getElementById('custPincode');
                const notesEl = document.getElementById('custNotes');
                if (nameEl || mobEl || addrEl) {
                    domCust = {
                        fullName: nameEl ? nameEl.value.trim() : '',
                        mobileNumber: mobEl ? mobEl.value.trim() : '',
                        address: addrEl ? addrEl.value.trim() : '',
                        city: cityEl ? cityEl.value.trim() : '',
                        state: stateEl ? stateEl.value.trim() : '',
                        pincode: pinEl ? pinEl.value.trim() : '',
                        notes: notesEl ? notesEl.value.trim() : ''
                    };
                }
            } catch (e) {}

            const custName = (customer.fullName || customer.name || customer.customer_name || orderData.customer_name || orderData.customerName || domCust.fullName || storedCust.fullName || '').trim();
            const rawMobile = String(customer.mobileNumber || customer.mobile || customer.phone || customer.customer_mobile || orderData.customer_mobile || orderData.customerMobile || domCust.mobileNumber || storedCust.mobileNumber || '').trim();
            const custMobile = rawMobile.replace(/^\+?91/, '').trim();
            const custAddress = (customer.address || customer.deliveryAddress || customer.delivery_address || orderData.delivery_address || orderData.deliveryAddress || domCust.address || storedCust.address || storedCust.deliveryAddress || '').trim();
            const custCity = (customer.city || orderData.city || domCust.city || storedCust.city || '').trim();
            const custState = (customer.state || orderData.state || domCust.state || storedCust.state || '').trim();
            const custPincode = String(customer.pincode || customer.pin || customer.pinCode || orderData.pincode || domCust.pincode || storedCust.pincode || '').trim();
            const custNotes = (customer.notes || customer.customer_notes || orderData.customer_notes || orderData.customerNotes || domCust.notes || storedCust.notes || '').trim();

            // A4 page dimensions
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 14;
            const contentWidth = pageWidth - (margin * 2); // 182mm

            // Palora Homes Palette
            const colorEspresso = [59, 34, 21];    // #3B2215
            const colorGold = [197, 155, 63];       // #C59B3F
            const colorCream = [250, 245, 237];     // #FAF5ED
            const colorBorder = [226, 215, 197];    // #E2D7C5
            const colorTextDark = [44, 30, 20];
            const colorTextMuted = [110, 95, 80];

            // 1. Top Decorative Gold Bar
            doc.setFillColor(...colorGold);
            doc.rect(margin, margin, contentWidth, 2.5, 'F');

            // 2. Header Brand & Contact
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(...colorEspresso);
            doc.text('PALORA HOMES', margin, margin + 11);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(...colorTextMuted);
            doc.text(config.tagline || 'Modern Living, Indian Soul', margin, margin + 16);

            // Contact Info on Right Side
            const whatsappText = `Official WhatsApp: ${config.whatsappDisplayNumber || '+91 93198 62081'}`;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...colorEspresso);
            doc.text(whatsappText, pageWidth - margin, margin + 11, { align: 'right' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...colorTextMuted);
            doc.text('Handcrafted Home Decor & Living Accents', pageWidth - margin, margin + 16, { align: 'right' });

            // 3. Document Title Banner: "CUSTOMER ORDER INQUIRY"
            const bannerY = margin + 21;
            const bannerHeight = 13;
            doc.setFillColor(...colorCream);
            doc.setDrawColor(...colorBorder);
            doc.setLineWidth(0.4);
            doc.rect(margin, bannerY, contentWidth, bannerHeight, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...colorEspresso);
            doc.text('CUSTOMER ORDER INQUIRY', margin + 4, bannerY + 8.5);

            // Status Pill on Banner Right (Dynamically styled based on order status)
            const orderStatus = (orderData.status || 'Pending Confirmation').trim();
            let pillBg = [255, 247, 237];       // Light Amber
            let pillBorder = [253, 186, 116];
            let pillTextColor = [194, 65, 12];  // Deep Amber
            let pillLabel = `Order Inquiry — ${orderStatus}`;

            const sLower = orderStatus.toLowerCase();
            if (sLower === 'confirmed') {
                pillBg = [240, 253, 244];       // Light Green
                pillBorder = [134, 239, 172];
                pillTextColor = [22, 101, 52];  // Forest Green
            } else if (sLower === 'in packaging') {
                pillBg = [254, 252, 232];       // Light Yellow
                pillBorder = [253, 224, 71];
                pillTextColor = [161, 98, 7];
            } else if (sLower === 'dispatched') {
                pillBg = [239, 246, 255];       // Soft Blue
                pillBorder = [147, 197, 253];
                pillTextColor = [29, 78, 216];
            } else if (sLower === 'delivered') {
                pillBg = [236, 253, 245];       // Emerald
                pillBorder = [110, 231, 183];
                pillTextColor = [4, 120, 87];
            } else if (sLower === 'cancelled') {
                pillBg = [254, 242, 242];       // Soft Red
                pillBorder = [252, 165, 165];
                pillTextColor = [185, 28, 28];
            }

            doc.setFillColor(...pillBg);
            doc.setDrawColor(...pillBorder);
            doc.setLineWidth(0.3);
            doc.roundedRect(pageWidth - margin - 72, bannerY + 2.5, 68, 8, 2, 2, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...pillTextColor);
            doc.text(pillLabel, pageWidth - margin - 38, bannerY + 7.5, { align: 'center' });

            // 4. Customer & Order Information Box (Two Columns)
            const infoBoxY = bannerY + bannerHeight + 4;
            const infoBoxHeight = 38;
            doc.setFillColor(253, 252, 250);
            doc.setDrawColor(230, 224, 215);
            doc.setLineWidth(0.3);
            doc.rect(margin, infoBoxY, contentWidth, infoBoxHeight, 'FD');

            // Left Column: Order Meta & Contact
            const col1X = margin + 4;
            const col2X = margin + (contentWidth / 2) + 2;
            let curY = infoBoxY + 6;

            // Order Inquiry Number
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...colorEspresso);
            doc.text('Order Inquiry Number:', col1X, curY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colorGold);
            doc.text(orderId, col1X + 34, curY);

            // Order Date and Time
            curY += 5.5;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colorEspresso);
            doc.text('Order Date & Time:', col1X, curY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colorTextDark);
            doc.text(dateStr, col1X + 34, curY);

            // Customer Name
            curY += 5.5;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colorEspresso);
            doc.text('Customer Full Name:', col1X, curY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colorTextDark);
            doc.text(custName || 'Valued Palora Customer', col1X + 34, curY);

            // Mobile Number
            curY += 5.5;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colorEspresso);
            doc.text('Mobile Number:', col1X, curY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colorTextDark);
            doc.text(custMobile ? `+91 ${custMobile}` : 'Provided on WhatsApp', col1X + 34, curY);

            // Order Status
            curY += 5.5;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colorEspresso);
            doc.text('Order Status:', col1X, curY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...pillTextColor);
            doc.text(orderStatus, col1X + 34, curY);

            // Right Column: Delivery Address & Notes
            curY = infoBoxY + 6;

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colorEspresso);
            doc.text('Delivery Address:', col2X, curY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colorTextDark);
            const addressText = doc.splitTextToSize(custAddress || 'To be confirmed on WhatsApp', (contentWidth / 2) - 34);
            doc.text(addressText, col2X + 28, curY);

            const addressLinesCount = Array.isArray(addressText) ? addressText.length : 1;
            curY += Math.max(7, addressLinesCount * 4.2);

            // City, State, PIN
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colorEspresso);
            doc.text('City, State, PIN:', col2X, curY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colorTextDark);
            const cityStatePin = (custCity || custState || custPincode)
                ? `${custCity || 'City'}, ${custState || 'State'} - ${custPincode || 'PIN'}`
                : 'To be confirmed on WhatsApp';
            doc.text(cityStatePin, col2X + 28, curY);

            // Order Notes
            curY += 5.5;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colorEspresso);
            doc.text('Order Notes:', col2X, curY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colorTextDark);
            const notesText = doc.splitTextToSize(custNotes || 'None', (contentWidth / 2) - 28);
            doc.text(notesText, col2X + 28, curY);

            // 5. Product List Table (AutoTable)
            const tableY = infoBoxY + infoBoxHeight + 5;

            let totalDistinct = items.length;
            let totalPacks = 0;
            let totalPieces = 0;
            let hasPrices = false;
            let totalPrice = 0;

            const tableRows = items.map((item, idx) => {
                const parsed = this.parseProductDetails(item);
                totalPacks += parsed.orderQty;
                totalPieces += parsed.totalPieces;

                let unitPriceStr = 'Inquiry Quote';
                let subtotalStr = 'Inquiry Quote';

                if (typeof parsed.unitPrice === 'number' && !isNaN(parsed.unitPrice)) {
                    hasPrices = true;
                    const subtotal = parsed.unitPrice * parsed.orderQty;
                    totalPrice += subtotal;
                    unitPriceStr = `₹${parsed.unitPrice.toLocaleString('en-IN')}`;
                    subtotalStr = `₹${subtotal.toLocaleString('en-IN')}`;
                }

                // Show pack detail if multiple pieces per pack
                let qtyDisplay = `${parsed.orderQty} pack${parsed.orderQty > 1 ? 's' : ''}`;
                if (parsed.packMultiplier > 1) {
                    qtyDisplay += `\n(${parsed.totalPieces} pcs total)`;
                } else {
                    qtyDisplay = `${parsed.orderQty} pc${parsed.orderQty > 1 ? 's' : ''}`;
                }

                return [
                    idx + 1,
                    parsed.categoryName,
                    parsed.cleanTitle,
                    parsed.size,
                    parsed.finish,
                    qtyDisplay,
                    unitPriceStr,
                    subtotalStr
                ];
            });

            // AutoTable Column Configuration
            doc.autoTable({
                startY: tableY,
                margin: { left: margin, right: margin },
                head: [[
                    'S. No.',
                    'Product Category',
                    'Product Name',
                    'Size / Dimensions',
                    'Colour / Finish',
                    'Quantity (Pcs)',
                    'Unit Price',
                    'Subtotal'
                ]],
                body: tableRows,
                theme: 'striped',
                showHead: 'everyPage',
                styles: {
                    font: 'helvetica',
                    fontSize: 7.5,
                    textColor: colorTextDark,
                    cellPadding: 2.6,
                    lineColor: colorBorder,
                    lineWidth: 0.2,
                    valign: 'middle',
                    overflow: 'linebreak'
                },
                headStyles: {
                    fillColor: colorEspresso,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 7.8,
                    halign: 'left'
                },
                alternateRowStyles: {
                    fillColor: [252, 249, 245]
                },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' },
                    1: { cellWidth: 26 },
                    2: { cellWidth: 44, fontStyle: 'bold' },
                    3: { cellWidth: 26 },
                    4: { cellWidth: 24 },
                    5: { cellWidth: 20, halign: 'center' },
                    6: { cellWidth: 15, halign: 'right' },
                    7: { cellWidth: 15, halign: 'right' }
                },
                didDrawPage: function (data) {
                    // Header / footer repeat logic
                }
            });

            // 6. Order Summary Below the Table
            let finalY = doc.lastAutoTable.finalY + 6;

            // If not enough room on current page for summary box, add page
            if (finalY + 44 > pageHeight - 16) {
                doc.addPage();
                finalY = margin + 10;
            }

            const summaryBoxHeight = 36;
            doc.setFillColor(253, 252, 250);
            doc.setDrawColor(220, 214, 204);
            doc.setLineWidth(0.3);
            doc.rect(margin, finalY, contentWidth, summaryBoxHeight, 'FD');

            // Left Summary: Item & Piece Counts
            const sumLeftX = margin + 4;
            let sumY = finalY + 5.5;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...colorEspresso);
            doc.text('ORDER SUMMARY', sumLeftX, sumY);

            sumY += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...colorTextDark);
            doc.text(`• Total Distinct Product Types:`, sumLeftX, sumY);
            doc.setFont('helvetica', 'bold');
            doc.text(`${totalDistinct} items`, sumLeftX + 48, sumY);

            sumY += 4.8;
            doc.setFont('helvetica', 'normal');
            doc.text(`• Total Ordered Packs / Items:`, sumLeftX, sumY);
            doc.setFont('helvetica', 'bold');
            doc.text(`${totalPacks} units`, sumLeftX + 48, sumY);

            sumY += 4.8;
            doc.setFont('helvetica', 'normal');
            doc.text(`• Total Individual Pieces:`, sumLeftX, sumY);
            doc.setFont('helvetica', 'bold');
            doc.text(`${totalPieces} pieces`, sumLeftX + 48, sumY);

            sumY += 4.8;
            doc.setFont('helvetica', 'normal');
            doc.text(`• Customer Instructions:`, sumLeftX, sumY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colorTextMuted);
            const notesBrief = (customer.notes && customer.notes.trim()) ? customer.notes.trim() : 'No special instructions provided';
            doc.text(doc.splitTextToSize(notesBrief, 60)[0], sumLeftX + 48, sumY);

            // Right Summary: Pricing & Shipping Status
            const sumRightX = margin + (contentWidth / 2) + 2;
            sumY = finalY + 5.5;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...colorEspresso);
            doc.text('PRICING & VERIFICATION STATUS', sumRightX, sumY);

            sumY += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...colorTextDark);
            doc.text('Subtotal:', sumRightX, sumY);
            doc.setFont('helvetica', 'bold');
            if (hasPrices) {
                doc.text(`₹${totalPrice.toLocaleString('en-IN')}`, pageWidth - margin - 4, sumY, { align: 'right' });
            } else {
                doc.text('Inquiry Quote', pageWidth - margin - 4, sumY, { align: 'right' });
            }

            sumY += 4.8;
            doc.setFont('helvetica', 'normal');
            doc.text('Shipping Charges:', sumRightX, sumY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(22, 101, 52); // Dark Green
            doc.text('Calculated & Confirmed on WhatsApp', pageWidth - margin - 4, sumY, { align: 'right' });

            sumY += 4.8;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colorEspresso);
            doc.text('Pricing Status:', sumRightX, sumY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(194, 65, 12);
            doc.text('Inquiry Quote — Price Confirmation Pending', pageWidth - margin - 4, sumY, { align: 'right' });

            sumY += 5.2;
            doc.setDrawColor(220, 214, 204);
            doc.setLineWidth(0.2);
            doc.line(sumRightX, sumY - 1, pageWidth - margin - 4, sumY - 1);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...colorEspresso);
            doc.text('Estimated Total:', sumRightX, sumY + 3.5);
            doc.setFont('helvetica', 'bold');
            if (hasPrices) {
                doc.text(`₹${totalPrice.toLocaleString('en-IN')}`, pageWidth - margin - 4, sumY + 3.5, { align: 'right' });
            } else {
                doc.text('Pending Availability & Quote Confirmation', pageWidth - margin - 4, sumY + 3.5, { align: 'right' });
            }

            // 7. Official Palora Homes Verification Note
            let noteY = finalY + summaryBoxHeight + 5;
            if (noteY + 14 > pageHeight - 16) {
                doc.addPage();
                noteY = margin + 10;
            }

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.2);
            doc.setTextColor(...colorTextMuted);
            const disclaimerText = "Note: This document is an official Palora Homes customer order inquiry sheet generated for order review. Product availability, customization, pan-India shipping transit times, and final payment options will be verified directly with our team on WhatsApp (+91 93198 62081). Modern Living, Indian Soul.";
            doc.text(doc.splitTextToSize(disclaimerText, contentWidth), margin, noteY);

            // 8. Footer on Every Page (Page Numbers & Copyright)
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setDrawColor(225, 218, 208);
                doc.setLineWidth(0.25);
                doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(140, 125, 110);
                doc.text('PALORA HOMES • Official WhatsApp: +91 93198 62081 • Modern Living, Indian Soul', margin, pageHeight - 8);
                doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
            }

            const fileName = `Palora-Homes-Order-Inquiry-${orderId}.pdf`;
            const pdfBlob = doc.output('blob');
            const pdfDataUri = doc.output('datauristring');

            return {
                doc: doc,
                pdfBlob: pdfBlob,
                pdfDataUri: pdfDataUri,
                orderId: orderId,
                fileName: fileName
            };
        },

        /**
         * Create an order record, generate its PDF, and save both
         * @param {Object} customerDetails
         * @param {Array} cartItems
         * @returns {Object}
         */
        createAndSaveOrder: function (customerDetails, cartItems) {
            const orderId = this.generateOrderInquiryId();
            const now = new Date();
            const formattedDate = now.toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short'
            }) + ' IST';

            const orderData = {
                orderId: orderId,
                createdAt: now.toISOString(),
                formattedDate: formattedDate,
                customer: customerDetails || {},
                items: cartItems || [],
                status: 'Pending Confirmation'
            };

            // Generate the PDF
            const pdfResult = this.generatePDF(orderData);

            // Store order record with base64 PDF data URI for instant re-download
            const orderRecord = {
                orderId: orderId,
                createdAt: orderData.createdAt,
                formattedDate: formattedDate,
                customer: orderData.customer,
                items: orderData.items,
                status: orderData.status,
                fileName: pdfResult.fileName,
                pdfDataUri: pdfResult.pdfDataUri
            };

            this.saveOrderInquiry(orderRecord);

            // Asynchronously dispatch order record to Supabase via Netlify Function
            this.syncOrderToCloud(orderRecord);

            return {
                orderRecord: orderRecord,
                pdfResult: pdfResult
            };
        },

        /**
         * Download an order PDF using cross-browser native FileSaver / Blob
         * @param {string} [orderId]
         */
        downloadPDF: function (orderId) {
            let order = orderId ? this.getOrderById(orderId) : null;

            // If order not found by ID, look for last created order or active cart
            if (!order) {
                const lastId = localStorage.getItem('palora_last_order_id');
                if (lastId) {
                    order = this.getOrderById(lastId);
                }
            }

            // Fallback: generate on-the-fly from active cart and saved/live customer details
            if (!order) {
                const cart = (window.PaloraCart && typeof window.PaloraCart.getCart === 'function')
                    ? window.PaloraCart.getCart()
                    : [];
                if (cart.length > 0) {
                    let custDetails = (window.PaloraCart && typeof window.PaloraCart.getCustomerDetails === 'function')
                        ? window.PaloraCart.getCustomerDetails()
                        : {};

                    order = {
                        orderId: orderId || this.generateOrderInquiryId(),
                        formattedDate: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) + ' IST',
                        customer: custDetails,
                        items: cart,
                        status: 'Pending Confirmation'
                    };
                }
            }

            if (!order) {
                alert(`No items found to generate Order Sheet. Please add items to your cart.`);
                return;
            }

            // Enrich customer details with any active form inputs or stored details
            if (order) {
                if (!order.customer) order.customer = {};
                try {
                    const rawStored = localStorage.getItem('palora_customer_details');
                    if (rawStored) {
                        const parsed = JSON.parse(rawStored);
                        order.customer = Object.assign({}, parsed, order.customer);
                    }
                    const nameEl = document.getElementById('custFullName');
                    const mobEl = document.getElementById('custMobile');
                    const addrEl = document.getElementById('custAddress');
                    const cityEl = document.getElementById('custCity');
                    const stateEl = document.getElementById('custState');
                    const pinEl = document.getElementById('custPincode');
                    const notesEl = document.getElementById('custNotes');
                    if (nameEl && nameEl.value.trim()) order.customer.fullName = nameEl.value.trim();
                    if (mobEl && mobEl.value.trim()) order.customer.mobileNumber = mobEl.value.trim();
                    if (addrEl && addrEl.value.trim()) order.customer.address = addrEl.value.trim();
                    if (cityEl && cityEl.value.trim()) order.customer.city = cityEl.value.trim();
                    if (stateEl && stateEl.value.trim()) order.customer.state = stateEl.value.trim();
                    if (pinEl && pinEl.value.trim()) order.customer.pincode = pinEl.value.trim();
                    if (notesEl && notesEl.value.trim()) order.customer.notes = notesEl.value.trim();
                } catch (e) {}
            }

            try {
                // Generate a fresh high-resolution document with complete customer details
                const res = this.generatePDF(order);
                const safeName = res.fileName || `Palora-Homes-Order-Inquiry-${order.orderId || 'sheet'}.pdf`;

                // Native jsPDF save triggers browser file download seamlessly
                res.doc.save(safeName);

                if (window.PaloraCart && typeof window.PaloraCart.showToast === 'function') {
                    window.PaloraCart.showToast('📥 Downloading Order Inquiry Sheet (PDF)...');
                }
            } catch (err) {
                console.warn('PaloraPDFOrder: doc.save failed, using cross-browser Blob fallback', err);
                try {
                    const res = this.generatePDF(order);
                    const blob = res.pdfBlob || new Blob([res.doc.output('blob')], { type: 'application/pdf' });
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = res.fileName || `Palora-Homes-Order-Inquiry-${order.orderId || 'sheet'}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(function () {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                    }, 500);
                } catch (blobErr) {
                    console.error('PaloraPDFOrder: All PDF download methods failed', blobErr);
                    alert('Could not download PDF. Please try again.');
                }
            }
        },

        /**
         * Print an order PDF
         * @param {string} [orderId]
         */
        printPDF: function (orderId) {
            let order = orderId ? this.getOrderById(orderId) : null;
            if (!order) {
                const lastId = localStorage.getItem('palora_last_order_id');
                if (lastId) order = this.getOrderById(lastId);
            }

            if (!order) {
                this.downloadPDF(orderId);
                return;
            }

            try {
                const res = this.generatePDF(order);
                const blob = res.pdfBlob || new Blob([res.doc.output('blob')], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                const win = window.open(blobUrl, '_blank');
                if (win) {
                    win.focus();
                } else {
                    res.doc.autoPrint();
                    res.doc.save(res.fileName);
                }
            } catch (err) {
                console.error('PaloraPDFOrder: Failed to print PDF', err);
                this.downloadPDF(orderId);
            }
        },

        /**
         * Display the Order Inquiry Confirmation Modal
         * @param {Object} orderRecord
         * @param {string} whatsappUrl
         */
        showOrderConfirmationModal: function (orderRecord, whatsappUrl) {
            let modal = document.getElementById('paloraOrderConfirmModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'paloraOrderConfirmModal';
                modal.className = 'palora-order-modal-backdrop';
                document.body.appendChild(modal);
            }

            const customer = orderRecord.customer || {};
            const items = orderRecord.items || [];
            const orderId = orderRecord.orderId;

            let totalQty = 0;
            items.forEach(it => { totalQty += (parseInt(it.quantity, 10) || 1); });

            modal.innerHTML = `
                <div class="palora-order-modal-card" role="dialog" aria-modal="true" aria-labelledby="modalOrderTitle">
                    <div class="modal-card-top-icon">
                        <div class="icon-circle">✓</div>
                    </div>

                    <h2 class="modal-order-title" id="modalOrderTitle">Order Inquiry Sheet Ready!</h2>
                    <p class="modal-order-sub">Your printable business PDF Order Inquiry has been generated and saved securely.</p>

                    <!-- Order Inquiry Reference Card -->
                    <div class="modal-order-ref-card">
                        <div class="ref-row">
                            <span class="ref-label">Order Inquiry No:</span>
                            <strong class="ref-value text-gold">${orderId}</strong>
                        </div>
                        <div class="ref-row">
                            <span class="ref-label">Customer Name:</span>
                            <span class="ref-value">${customer.fullName || 'Valued Customer'}</span>
                        </div>
                        <div class="ref-row">
                            <span class="ref-label">Delivery Location:</span>
                            <span class="ref-value">${customer.city || ''}, ${customer.state || ''}</span>
                        </div>
                        <div class="ref-row">
                            <span class="ref-label">Total Selections:</span>
                            <span class="ref-value"><strong>${items.length} Distinct Products (${totalQty} Pieces)</strong></span>
                        </div>
                        <div class="ref-row">
                            <span class="ref-label">Document Status:</span>
                            <span class="ref-badge-pending">Pending Confirmation</span>
                        </div>
                    </div>

                    <!-- PDF Action Buttons -->
                    <div class="modal-actions-list">
                        <!-- 1. Download PDF Button -->
                        <button type="button" class="btn-modal-download-pdf" id="btnModalDownloadPDF" data-order-id="${orderId}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>Download PDF Order Sheet (A4)</span>
                        </button>

                        <!-- 2. Send via WhatsApp Button -->
                        <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-modal-wa-send" id="btnModalSendWA">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.507 14.307l-.009.075c-2.387-1.196-2.822-1.423-3.26-1.077-.282.223-.559.57-.866.864-.325.312-.662.355-1.189.09-1.996-1.002-3.32-2.316-4.329-4.306-.264-.523-.223-.859.088-1.185.293-.309.642-.584.866-.867.348-.439.12-1.076-1.074-3.465C8.423 3.738 8.01 3.753 7.643 3.753c-.328 0-.712.112-1.085.518-.372.408-1.425 1.391-1.425 3.394 0 2.003 1.458 3.94 1.66 4.215.204.275 2.872 4.385 6.958 6.147 2.721 1.173 3.805 1.055 4.496.985.992-.102 2.387-.977 2.724-1.924.338-.948.338-1.761.238-1.925-.102-.164-.372-.266-.702-.456zM12 2a10 10 0 0 0-8.66 15L2 22l5.14-1.34A10 10 0 1 0 12 2z"/>
                            </svg>
                            <span class="btn-wa-text-wrap">
                                <span class="btn-wa-main-text">Send Order on WhatsApp</span>
                                <span class="btn-wa-sub-text">Opens chat with inquiry ref #${orderId}</span>
                            </span>
                        </a>

                        <!-- 3. Print Option & Close -->
                        <div class="modal-sub-actions">
                            <button type="button" class="btn-modal-print" id="btnModalPrintPDF" data-order-id="${orderId}">
                                🖨️ Print Order Sheet
                            </button>
                            <button type="button" class="btn-modal-close" id="btnModalClose">
                                Close Window
                            </button>
                        </div>
                    </div>

                    <p class="modal-footer-note">A copy of your PDF Order Inquiry has been generated. When WhatsApp opens, review the message and press <strong>Send</strong> to confirm with Palora Homes.</p>
                </div>
            `;

            modal.classList.add('visible');
            document.body.classList.add('modal-open');

            // Attach listeners inside modal
            const downloadBtn = modal.querySelector('#btnModalDownloadPDF');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    this.downloadPDF(orderId);
                });
            }

            const printBtn = modal.querySelector('#btnModalPrintPDF');
            if (printBtn) {
                printBtn.addEventListener('click', () => {
                    this.printPDF(orderId);
                });
            }

            const closeBtn = modal.querySelector('#btnModalClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.classList.remove('visible');
                    document.body.classList.remove('modal-open');
                });
            }

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('visible');
                    document.body.classList.remove('modal-open');
                }
            });
        },

        escapeHtml: function (str) {
            return String(str || '').replace(/[&<>"']/g, function (m) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
            });
        },

        /**
         * Display Customer-Facing Order Inquiry Sheet Modal
         * Allows shoppers to view their current order sheet, preview/edit customer details,
         * and instantly download or print their A4 PDF without an admin PIN gate.
         */
        showCustomerOrderSheetModal: function () {
            let modal = document.getElementById('paloraCustomerOrderSheetModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'paloraCustomerOrderSheetModal';
                modal.className = 'palora-order-modal-backdrop';
                document.body.appendChild(modal);
            }

            const self = this;
            const cart = (window.PaloraCart && typeof window.PaloraCart.getCart === 'function')
                ? window.PaloraCart.getCart()
                : [];

            // Retrieve customer details
            let cust = (window.PaloraCart && typeof window.PaloraCart.getCustomerDetails === 'function')
                ? window.PaloraCart.getCustomerDetails()
                : {};

            // Also check live form inputs if user already started typing on checkout page
            try {
                const nameEl = document.getElementById('custFullName');
                const mobEl = document.getElementById('custMobile');
                const addrEl = document.getElementById('custAddress');
                const cityEl = document.getElementById('custCity');
                const stateEl = document.getElementById('custState');
                const pinEl = document.getElementById('custPincode');
                const notesEl = document.getElementById('custNotes');
                if (nameEl && nameEl.value.trim()) cust.fullName = nameEl.value.trim();
                if (mobEl && mobEl.value.trim()) cust.mobileNumber = mobEl.value.trim();
                if (addrEl && addrEl.value.trim()) cust.address = addrEl.value.trim();
                if (cityEl && cityEl.value.trim()) cust.city = cityEl.value.trim();
                if (stateEl && stateEl.value.trim()) cust.state = stateEl.value.trim();
                if (pinEl && pinEl.value.trim()) cust.pincode = pinEl.value.trim();
                if (notesEl && notesEl.value.trim()) cust.notes = notesEl.value.trim();
            } catch (e) {}

            let totalQty = 0;
            let totalPrice = 0;
            let hasPrices = false;
            cart.forEach(it => {
                const q = parseInt(it.quantity, 10) || 1;
                totalQty += q;
                if (typeof it.price === 'number' && !isNaN(it.price)) {
                    hasPrices = true;
                    totalPrice += (it.price * q);
                }
            });

            const hasCustomerData = !!(cust.fullName && cust.mobileNumber && (cust.address || cust.deliveryAddress));

            modal.innerHTML = `
                <div class="palora-order-modal-card" role="dialog" aria-modal="true" style="max-width: 580px;">
                    <div class="modal-card-top-icon">
                        <div class="icon-circle" style="background: linear-gradient(135deg, var(--color-brown-900), var(--color-gold)); font-size: 1.5rem;">📄</div>
                    </div>

                    <h2 class="modal-order-title" style="margin-bottom: 4px; font-size: 1.45rem;">Customer Order Inquiry Sheet</h2>
                    <p class="modal-order-sub" style="margin-bottom: 16px;">Download or preview your printable business A4 PDF sheet for Palora Homes handcrafted decor.</p>

                    <!-- Cart Selections Summary -->
                    <div style="background: #FAF6F0; border: 1px solid #E6DED2; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; font-size: 0.84rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="color: var(--color-brown-600); font-weight: 500;">Cart Selections:</span>
                            <strong style="color: var(--color-brown-950);">${cart.length} distinct product${cart.length !== 1 ? 's' : ''} (${totalQty} total piece${totalQty !== 1 ? 's' : ''})</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--color-brown-600); font-weight: 500;">Pricing Status:</span>
                            <strong style="color: #166534;">${hasPrices ? '₹' + totalPrice.toLocaleString('en-IN') + ' (Estimated)' : 'Direct WhatsApp Inquiry Quote'}</strong>
                        </div>
                    </div>

                    <!-- Customer & Delivery Details Section -->
                    <div style="background: #FFFFFF; border: 1.5px solid ${hasCustomerData ? '#BBF7D0' : '#FDE68A'}; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 1rem;">${hasCustomerData ? '✅' : '✏️'}</span>
                                <strong style="font-size: 0.88rem; color: var(--color-brown-950);">Customer &amp; Delivery Details</strong>
                            </div>
                            <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 10px; font-weight: 700; ${hasCustomerData ? 'background: #DCFCE7; color: #166534;' : 'background: #FEF3C7; color: #B45309;'}">
                                ${hasCustomerData ? 'Details Added' : 'Pending Details'}
                            </span>
                        </div>

                        ${hasCustomerData ? `
                            <div style="font-size: 0.82rem; line-height: 1.5; color: #333;">
                                <div><strong>Name:</strong> ${self.escapeHtml(cust.fullName)}</div>
                                <div><strong>Mobile:</strong> +91 ${self.escapeHtml(cust.mobileNumber)}</div>
                                <div><strong>Address:</strong> ${self.escapeHtml(cust.address || cust.deliveryAddress)}, ${self.escapeHtml(cust.city || '')}, ${self.escapeHtml(cust.state || '')} - ${self.escapeHtml(cust.pincode || '')}</div>
                                ${cust.notes ? `<div><strong>Notes:</strong> ${self.escapeHtml(cust.notes)}</div>` : ''}
                            </div>
                            <button type="button" id="btnModalEditDetails" style="margin-top: 10px; background: none; border: none; color: var(--color-gold-dark); font-size: 0.76rem; font-weight: 700; cursor: pointer; text-decoration: underline; padding: 0;">
                                Edit Delivery Details in Checkout &rarr;
                            </button>
                        ` : `
                            <p style="font-size: 0.8rem; color: #666; margin: 0 0 10px;">Enter your details below to include your name and delivery address directly on the PDF Order Sheet:</p>
                            <form id="quickCustomerDetailsForm" style="display: flex; flex-direction: column; gap: 8px;">
                                <input type="text" id="quickCustName" placeholder="Full Name *" class="form-input" style="padding: 7px 10px; font-size: 0.82rem;" value="${self.escapeHtml(cust.fullName || '')}" required>
                                <div style="display: flex; gap: 8px;">
                                    <input type="tel" id="quickCustMobile" placeholder="10-digit Mobile Number *" class="form-input" style="padding: 7px 10px; font-size: 0.82rem; flex: 1;" value="${self.escapeHtml(cust.mobileNumber || '')}" required maxlength="10">
                                    <input type="text" id="quickCustCity" placeholder="City *" class="form-input" style="padding: 7px 10px; font-size: 0.82rem; flex: 1;" value="${self.escapeHtml(cust.city || '')}" required>
                                </div>
                                <textarea id="quickCustAddress" placeholder="Complete Delivery Address *" class="form-textarea" rows="2" style="padding: 7px 10px; font-size: 0.82rem;" required>${self.escapeHtml(cust.address || cust.deliveryAddress || '')}</textarea>
                                <button type="submit" style="align-self: flex-start; padding: 6px 14px; background: var(--color-brown-900); color: #FFF; border: none; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer;">
                                    Save Details to PDF
                                </button>
                            </form>
                        `}
                    </div>

                    <!-- PDF Actions -->
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
                        <button type="button" class="btn-modal-download-pdf" id="btnModalQuickDownloadPDF" style="font-size: 0.92rem; padding: 12px 18px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>Download Printable A4 PDF Sheet</span>
                        </button>

                        <div style="display: flex; gap: 8px;">
                            <button type="button" class="btn-modal-print" id="btnModalQuickPrintPDF" style="flex: 1; padding: 10px; font-size: 0.82rem; border-radius: var(--radius-sm); border: 1px solid #CCC; background: #FFF; cursor: pointer;">
                                🖨️ Print Sheet
                            </button>
                            <button type="button" class="btn-modal-close" id="btnModalCustomerClose" style="flex: 1; padding: 10px; font-size: 0.82rem; border-radius: var(--radius-sm);">
                                Close
                            </button>
                        </div>
                    </div>

                    <!-- Store Admin Portal Access Footer Link -->
                    <div style="text-align: center; border-top: 1px solid #EEE; padding-top: 12px; margin-top: 8px;">
                        <button type="button" id="btnModalOpenAdminPortal" style="background: none; border: none; color: #888; font-size: 0.72rem; cursor: pointer; text-decoration: underline;">
                            🔒 Store Administrator? Manage all customer inquiries &amp; cloud orders
                        </button>
                    </div>
                </div>
            `;

            modal.classList.add('visible');
            document.body.classList.add('modal-open');

            function closeModal() {
                modal.classList.remove('visible');
                document.body.classList.remove('modal-open');
            }

            modal.querySelector('#btnModalCustomerClose')?.addEventListener('click', closeModal);
            modal.addEventListener('click', function (e) {
                if (e.target === modal) closeModal();
            });

            // Download PDF button
            modal.querySelector('#btnModalQuickDownloadPDF')?.addEventListener('click', function () {
                self.downloadPDF();
            });

            // Print PDF button
            modal.querySelector('#btnModalQuickPrintPDF')?.addEventListener('click', function () {
                self.printPDF();
            });

            // Quick details form submit
            const quickForm = modal.querySelector('#quickCustomerDetailsForm');
            if (quickForm) {
                quickForm.addEventListener('submit', function (e) {
                    e.preventDefault();
                    const n = modal.querySelector('#quickCustName').value.trim();
                    const m = modal.querySelector('#quickCustMobile').value.trim();
                    const c = modal.querySelector('#quickCustCity').value.trim();
                    const a = modal.querySelector('#quickCustAddress').value.trim();
                    if (!n || !m || !a) {
                        alert('Please enter Name, Mobile, and Delivery Address.');
                        return;
                    }
                    const updated = {
                        fullName: n,
                        mobileNumber: m,
                        address: a,
                        city: c,
                        state: cust.state || '',
                        pincode: cust.pincode || '',
                        notes: cust.notes || ''
                    };
                    if (window.PaloraCart && typeof window.PaloraCart.saveCustomerDetails === 'function') {
                        window.PaloraCart.saveCustomerDetails(updated);
                    }
                    if (window.PaloraCart && typeof window.PaloraCart.showToast === 'function') {
                        window.PaloraCart.showToast('✓ Customer details saved for PDF Sheet!');
                    }
                    self.showCustomerOrderSheetModal();
                });
            }

            // Edit Details link -> go to Step 2
            modal.querySelector('#btnModalEditDetails')?.addEventListener('click', function () {
                closeModal();
                if (typeof window.PaloraCartGoToStep === 'function') {
                    window.PaloraCartGoToStep('checkout');
                } else {
                    const btn = document.getElementById('btnProceedToCustomerDetails');
                    if (btn) btn.click();
                }
            });

            // Switch to Admin Portal
            modal.querySelector('#btnModalOpenAdminPortal')?.addEventListener('click', function () {
                closeModal();
                self.showOrdersHistoryModal();
            });
        },

        /**
         * Display the Owner / Admin Orders Inquiries History Modal
         * Includes PIN gate, live search by Order ID / Mobile Number, status updater, PDF download/print, and CSV export
         */
        showOrdersHistoryModal: function () {
            let modal = document.getElementById('paloraOrdersHistoryModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'paloraOrdersHistoryModal';
                modal.className = 'palora-order-modal-backdrop';
                document.body.appendChild(modal);
            }

            const self = this;

            // Render function based on authentication state
            function renderContent() {
                if (!self.isAdminAuthenticated()) {
                    renderPinPrompt();
                } else {
                    renderDashboardView();
                }
            }

            // PIN Gate
            function renderPinPrompt() {
                modal.innerHTML = `
                    <div class="palora-order-modal-card admin-pin-card" role="dialog" aria-modal="true" style="max-width: 440px; text-align: center;">
                        <div class="modal-card-top-icon">
                            <div class="icon-circle" style="background: linear-gradient(135deg, var(--color-brown-900), var(--color-gold)); font-size: 1.4rem;">🔒</div>
                        </div>
                        <h2 class="modal-order-title" style="font-size: 1.35rem; margin-bottom: 4px;">Secure Admin Access</h2>
                        <p class="modal-order-sub" style="font-size: 0.82rem; margin-bottom: 18px;">Enter your store administrator PIN to access customer order inquiries and PDF sheets.</p>
                        
                        <form id="adminPinForm" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 14px;">
                            <input 
                                type="password" 
                                id="adminPinInput" 
                                placeholder="Enter Admin PIN" 
                                class="form-input" 
                                style="text-align: center; letter-spacing: 4px; font-size: 1.2rem; font-weight: 700;"
                                autofocus 
                                required
                            >
                            <span id="pinErrorText" style="color: #DC2626; font-size: 0.78rem; display: none;">⚠️ Incorrect PIN. Please try again.</span>
                            
                            <button type="submit" class="btn-modal-download-pdf" style="padding: 10px; font-size: 0.9rem;">
                                Unlock Admin Management &rarr;
                            </button>
                        </form>

                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.74rem; color: #888; border-top: 1px solid #EEE; padding-top: 10px;">
                            <span>Palora Homes Admin</span>
                            <button type="button" class="btn-modal-close" id="btnPinModalClose" style="padding: 4px 12px; font-size: 0.74rem;">Close</button>
                        </div>
                    </div>
                `;

                modal.classList.add('visible');
                document.body.classList.add('modal-open');

                const pinForm = modal.querySelector('#adminPinForm');
                const pinInput = modal.querySelector('#adminPinInput');
                const pinErr = modal.querySelector('#pinErrorText');
                const submitBtn = modal.querySelector('button[type="submit"]');

                if (pinForm) {
                    pinForm.addEventListener('submit', async function (e) {
                        e.preventDefault();
                        const val = pinInput.value;
                        if (submitBtn) {
                            submitBtn.disabled = true;
                            submitBtn.textContent = 'Verifying PIN...';
                        }

                        try {
                            const ok = await self.verifyAdminPin(val);
                            if (ok) {
                                renderDashboardView();
                            } else {
                                pinErr.style.display = 'block';
                                pinInput.value = '';
                                pinInput.focus();
                            }
                        } finally {
                            if (submitBtn) {
                                submitBtn.disabled = false;
                                submitBtn.textContent = 'Unlock Admin Management →';
                            }
                        }
                    });
                }

                modal.querySelector('#btnPinModalClose')?.addEventListener('click', closeModal);
            }

            // Interactive Orders Management Dashboard View
            function renderDashboardView() {
                const orders = self.getAllOrders();

                // Compute quick stats
                let pendingCount = 0;
                let confirmedCount = 0;
                let dispatchedCount = 0;
                let totalPiecesSum = 0;

                orders.forEach(function (o) {
                    const st = (o.status || 'pending confirmation').toLowerCase();
                    if (st === 'confirmed') confirmedCount++;
                    else if (st === 'dispatched' || st === 'in packaging') dispatchedCount++;
                    else pendingCount++;

                    (o.items || []).forEach(function (it) {
                        const q = parseInt(it.quantity, 10) || 1;
                        let mult = 1;
                        if (/pair|\b2\s*pcs\b/i.test(it.specs || '')) mult = 2;
                        else if (/set of (\d+)/i.test(it.specs || '')) {
                            const m = (it.specs || '').match(/set of (\d+)/i);
                            if (m && m[1]) mult = parseInt(m[1], 10) || 1;
                        }
                        totalPiecesSum += (q * mult);
                    });
                });

                modal.innerHTML = `
                    <div class="palora-order-modal-card admin-history-card" role="dialog" aria-modal="true" style="max-width: 920px;">
                        <div class="admin-modal-header" style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid var(--color-border);">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <h2 style="font-family: var(--font-serif); font-size: 1.45rem; color: var(--color-brown-950); margin: 0;">Customer Order Inquiries Management</h2>
                                    <span style="font-size: 0.72rem; padding: 2px 8px; background: #DCFCE7; color: #166534; font-weight: 700; border-radius: 10px;">Admin Active</span>
                                </div>
                                <p style="font-size: 0.8rem; color: var(--color-brown-600); margin: 3px 0 0;">View, search, update statuses, download & print official PDF order sheets.</p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <a href="admin.html" target="_blank" style="font-size: 0.78rem; font-weight: 600; color: var(--color-gold-dark); text-decoration: none; border: 1px solid var(--color-gold); padding: 5px 12px; border-radius: 14px;">
                                    Open Full Dashboard &nearr;
                                </a>
                                <button type="button" class="drawer-close-btn" id="btnAdminClose" style="background: none; border: none; font-size: 1.6rem; cursor: pointer; color: #666;">&times;</button>
                            </div>
                        </div>

                        <!-- Quick Summary Chips -->
                        <div style="display: flex; gap: 10px; margin: 14px 0; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 110px; background: #F8F5F0; padding: 10px 14px; border-radius: 8px; border: 1px solid #E6DED2;">
                                <span style="font-size: 0.7rem; color: #666; text-transform: uppercase;">Total Inquiries</span>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--color-brown-950);">${orders.length}</div>
                            </div>
                            <div style="flex: 1; min-width: 110px; background: #FFFBEB; padding: 10px 14px; border-radius: 8px; border: 1px solid #FDE68A;">
                                <span style="font-size: 0.7rem; color: #B45309; text-transform: uppercase;">Pending Confirmation</span>
                                <div style="font-size: 1.25rem; font-weight: 700; color: #B45309;">${pendingCount}</div>
                            </div>
                            <div style="flex: 1; min-width: 110px; background: #F0FDF4; padding: 10px 14px; border-radius: 8px; border: 1px solid #BBF7D0;">
                                <span style="font-size: 0.7rem; color: #166534; text-transform: uppercase;">Confirmed</span>
                                <div style="font-size: 1.25rem; font-weight: 700; color: #166534;">${confirmedCount}</div>
                            </div>
                            <div style="flex: 1; min-width: 110px; background: #EFF6FF; padding: 10px 14px; border-radius: 8px; border: 1px solid #BFDBFE;">
                                <span style="font-size: 0.7rem; color: #1D4ED8; text-transform: uppercase;">Packaging / Dispatched</span>
                                <div style="font-size: 1.25rem; font-weight: 700; color: #1D4ED8;">${dispatchedCount}</div>
                            </div>
                            <div style="flex: 1; min-width: 110px; background: #FAF5ED; padding: 10px 14px; border-radius: 8px; border: 1px solid #E2D7C5;">
                                <span style="font-size: 0.7rem; color: var(--color-brown-700); text-transform: uppercase;">Total Pieces</span>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--color-gold-dark);">${totalPiecesSum} pcs</div>
                            </div>
                        </div>

                        <!-- Filter & Search Toolbar -->
                        <div style="display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;">
                            <div style="flex: 2; min-width: 200px; position: relative;">
                                <input 
                                    type="text" 
                                    id="adminSearchInput" 
                                    placeholder="🔍 Search by Order ID (PH-...) or Mobile Number..." 
                                    class="form-input" 
                                    style="padding: 8px 12px; font-size: 0.84rem; width: 100%; border-radius: 6px;"
                                >
                            </div>
                            <div style="flex: 1; min-width: 150px;">
                                <select id="adminStatusFilter" class="form-select" style="padding: 8px 10px; font-size: 0.84rem; width: 100%; border-radius: 6px;">
                                    <option value="all">All Statuses</option>
                                    <option value="pending confirmation">Pending Confirmation</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="in packaging">In Packaging</option>
                                    <option value="dispatched">Dispatched</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <button type="button" id="btnAdminExportCSV" class="btn-modal-close" style="padding: 7px 12px; font-size: 0.76rem; font-weight: 600;">
                                    📊 CSV Export
                                </button>
                                <button type="button" id="btnAdminExportJSON" class="btn-modal-close" style="padding: 7px 12px; font-size: 0.76rem; font-weight: 600;">
                                    💾 Backup JSON
                                </button>
                            </div>
                        </div>

                        <!-- Orders Table Container -->
                        <div class="admin-table-scroll" style="max-height: 380px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 8px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
                                <thead>
                                    <tr style="background: var(--color-brown-950); color: #FFF; position: sticky; top: 0; z-index: 2;">
                                        <th style="padding: 10px 12px;">Inquiry No. &amp; Date</th>
                                        <th style="padding: 10px 12px;">Customer Details</th>
                                        <th style="padding: 10px 12px;">Items &amp; Pieces</th>
                                        <th style="padding: 10px 12px;">Order Status</th>
                                        <th style="padding: 10px 12px; text-align: right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="adminOrdersTableBody">
                                    <!-- Rendered dynamically -->
                                </tbody>
                            </table>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
                            <span style="font-size: 0.74rem; color: #777;" id="adminOrdersCountText">Showing ${orders.length} order inquiries</span>
                            <div style="display: flex; gap: 8px;">
                                <button type="button" id="btnAdminLogout" style="padding: 6px 14px; border: 1px solid #CCC; border-radius: 14px; background: #FFF; font-size: 0.74rem; cursor: pointer; color: #666;">
                                    🔒 Lock Admin
                                </button>
                                <button type="button" class="btn-modal-close" id="btnAdminCloseBottom" style="padding: 6px 16px; border-radius: 14px; font-size: 0.78rem;">
                                    Close Window
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                modal.classList.add('visible');
                document.body.classList.add('modal-open');

                const searchInput = modal.querySelector('#adminSearchInput');
                const statusFilter = modal.querySelector('#adminStatusFilter');
                const tbody = modal.querySelector('#adminOrdersTableBody');
                const countText = modal.querySelector('#adminOrdersCountText');

                function refreshTableRows() {
                    const q = searchInput ? searchInput.value : '';
                    const filter = statusFilter ? statusFilter.value : 'all';
                    const filtered = self.searchOrders(q, filter);

                    if (countText) {
                        countText.textContent = `Showing ${filtered.length} of ${orders.length} order inquiries`;
                    }

                    if (filtered.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 28px; color: #888;">No matching order inquiries found.</td></tr>`;
                        return;
                    }

                    tbody.innerHTML = filtered.map(function (o) {
                        const cust = o.customer || {};
                        const items = o.items || [];
                        let qty = 0;
                        items.forEach(function (it) { qty += (parseInt(it.quantity, 10) || 1); });
                        const currentStatus = o.status || 'Pending Confirmation';

                        return `
                            <tr style="border-bottom: 1px solid #EFEAE3;">
                                <td style="padding: 9px 12px; vertical-align: top;">
                                    <strong style="color: var(--color-brown-950);">${escapeHtml(o.orderId)}</strong>
                                    <div style="font-size: 0.72rem; color: #666; margin-top: 2px;">${escapeHtml(o.formattedDate || '')}</div>
                                </td>
                                <td style="padding: 9px 12px; vertical-align: top;">
                                    <strong>${self.escapeHtml(cust.fullName || cust.name || cust.customer_name || 'Valued Customer')}</strong>
                                    <div style="font-size: 0.74rem; color: #555;">📱 <a href="tel:+91${self.escapeHtml(cust.mobileNumber || cust.mobile || cust.phone || cust.customer_mobile || '')}" style="color: inherit; text-decoration: none;">+91 ${self.escapeHtml(cust.mobileNumber || cust.mobile || cust.phone || cust.customer_mobile || '')}</a></div>
                                    <div style="font-size: 0.72rem; color: #777;">📍 ${self.escapeHtml(cust.city || '')}${cust.city && cust.state ? ', ' : ''}${self.escapeHtml(cust.state || '')} ${cust.pincode ? '- ' + self.escapeHtml(cust.pincode) : ''}</div>
                                </td>
                                <td style="padding: 9px 12px; vertical-align: top;">
                                    <div>${items.length} items (${qty} pcs)</div>
                                    ${cust.notes ? `<div style="font-size: 0.7rem; color: #B45309; margin-top: 2px;">💬 Notes: ${escapeHtml(cust.notes.slice(0, 30))}${cust.notes.length > 30 ? '...' : ''}</div>` : ''}
                                </td>
                                <td style="padding: 9px 12px; vertical-align: top;">
                                    <select class="admin-row-status-select" data-order-id="${escapeHtml(o.orderId)}" style="padding: 4px 6px; font-size: 0.74rem; border-radius: 4px; border: 1px solid #CCC; background: #FFF; font-weight: 600;">
                                        <option value="Pending Confirmation" ${currentStatus === 'Pending Confirmation' ? 'selected' : ''}>Pending Confirmation</option>
                                        <option value="Confirmed" ${currentStatus === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                                        <option value="In Packaging" ${currentStatus === 'In Packaging' ? 'selected' : ''}>In Packaging</option>
                                        <option value="Dispatched" ${currentStatus === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
                                        <option value="Delivered" ${currentStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
                                        <option value="Cancelled" ${currentStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                                    </select>
                                </td>
                                <td style="padding: 9px 12px; vertical-align: top; text-align: right;">
                                    <div style="display: inline-flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
                                        <button type="button" class="btn-admin-dl-pdf" data-dl-order-id="${escapeHtml(o.orderId)}" title="Download A4 PDF Sheet">
                                            📥 PDF
                                        </button>
                                        <button type="button" class="btn-admin-print-pdf" data-print-order-id="${escapeHtml(o.orderId)}" title="Print A4 PDF Sheet" style="padding: 5px 8px; border: 1px solid #CCC; background: #FFF; border-radius: 4px; font-size: 0.72rem; cursor: pointer;">
                                            🖨️ Print
                                        </button>
                                        <a href="${self.getWhatsAppStatusUpdateUrl(o.orderId, o.status) || '#'}" target="_blank" rel="noopener noreferrer" title="Send WhatsApp status update to customer" style="padding: 5px 8px; border: 1px solid #10B981; color: #047857; background: #ECFDF5; border-radius: 4px; font-size: 0.72rem; text-decoration: none; display: inline-flex; align-items: center;">
                                            💬 Update
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('');

                    // Attach row listeners
                    tbody.querySelectorAll('.admin-row-status-select').forEach(function (sel) {
                        sel.addEventListener('change', function () {
                            const id = sel.getAttribute('data-order-id');
                            const newSt = sel.value;
                            self.updateOrderStatus(id, newSt);
                            if (window.PaloraCart && typeof window.PaloraCart.showToast === 'function') {
                                window.PaloraCart.showToast(`Order #${id} updated to "${newSt}"`);
                            }
                        });
                    });

                    tbody.querySelectorAll('[data-dl-order-id]').forEach(function (btn) {
                        btn.addEventListener('click', function () {
                            self.downloadPDF(btn.getAttribute('data-dl-order-id'));
                        });
                    });

                    tbody.querySelectorAll('[data-print-order-id]').forEach(function (btn) {
                        btn.addEventListener('click', function () {
                            self.printPDF(btn.getAttribute('data-print-order-id'));
                        });
                    });
                }

                // Initial rows render
                refreshTableRows();

                // Live Search & Filter
                if (searchInput) {
                    searchInput.addEventListener('input', refreshTableRows);
                }
                if (statusFilter) {
                    statusFilter.addEventListener('change', refreshTableRows);
                }

                // Exports
                modal.querySelector('#btnAdminExportCSV')?.addEventListener('click', function () {
                    self.exportOrdersCSV();
                });
                modal.querySelector('#btnAdminExportJSON')?.addEventListener('click', function () {
                    self.exportOrdersJSON();
                });

                // Logout
                modal.querySelector('#btnAdminLogout')?.addEventListener('click', function () {
                    self.logoutAdmin();
                    renderPinPrompt();
                });

                // Close handlers
                modal.querySelector('#btnAdminClose')?.addEventListener('click', closeModal);
                modal.querySelector('#btnAdminCloseBottom')?.addEventListener('click', closeModal);
            }

            function closeModal() {
                modal.classList.remove('visible');
                document.body.classList.remove('modal-open');
            }

            function escapeHtml(str) {
                return String(str || '').replace(/[&<>"']/g, function (m) {
                    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
                });
            }

            renderContent();
        },

        /**
         * ====================================================================
         * CLOUD INTEGRATION APIS (SUPABASE VIA NETLIFY SERVERLESS FUNCTIONS)
         * ====================================================================
         */

        /**
         * Asynchronously send an order inquiry to Supabase database
         * @param {Object} orderRecord
         * @returns {Promise<Object>}
         */
        syncOrderToCloud: async function (orderRecord) {
            // 1. If direct Supabase client is configured, save directly using public anon key & RLS
            if (window.PaloraSupabase && window.PaloraSupabase.isConfigured()) {
                try {
                    const sbRes = await window.PaloraSupabase.createOrder(orderRecord);
                    if (sbRes.success) {
                        console.log('PaloraPDFOrder: Order saved directly to Supabase via RLS', sbRes);
                        return { success: true, data: sbRes };
                    }
                } catch (sbErr) {
                    console.info('PaloraPDFOrder: Direct Supabase sync attempted, trying Netlify API endpoint.', sbErr.message);
                }
            }

            // 2. Serverless Function Proxy (/api/create-order)
            try {
                const payload = {
                    orderId: orderRecord.orderId,
                    formattedDate: orderRecord.formattedDate,
                    customer: orderRecord.customer || {},
                    items: orderRecord.items || [],
                    status: orderRecord.status || 'Pending Confirmation'
                };

                const res = await fetch('/api/create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const data = await res.json();
                    console.log('PaloraPDFOrder: Order saved to Supabase cloud successfully', data);
                    return { success: true, data: data };
                } else {
                    const errText = await res.text();
                    console.warn('PaloraPDFOrder: Cloud save response not OK', res.status, errText);
                    return { success: false, error: errText };
                }
            } catch (err) {
                console.info('PaloraPDFOrder: Cloud API not reachable; order preserved locally in browser.');
                return { success: false, error: err.message };
            }
        },

        /**
         * Fetch all orders from Supabase via get-orders Netlify Function
         * @param {string} [query]
         * @param {string} [status]
         * @returns {Promise<Array>}
         */
        fetchCloudOrders: async function (query, status) {
            const pin = this.getAdminPin();
            const q = encodeURIComponent(query || '');
            const s = encodeURIComponent(status || 'all');
            const url = `/api/get-orders?query=${q}&status=${s}&limit=150`;

            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-pin': pin
                }
            });

            if (!res.ok) {
                throw new Error(`Cloud fetch failed with status ${res.status}`);
            }

            const data = await res.json();
            const orders = (data && Array.isArray(data.orders)) ? data.orders : [];

            // Populate cloud memory cache for cross-device PDF printing/downloading
            if (!window._paloraCloudOrdersCache) window._paloraCloudOrdersCache = {};
            orders.forEach(function (o) {
                window._paloraCloudOrdersCache[o.orderId] = o;
            });

            return orders;
        },

        /**
         * Update an order status in Supabase via Netlify Function
         * @param {string} orderId
         * @param {string} newStatus
         * @param {string} [adminNotes]
         * @returns {Promise<Object>}
         */
        updateCloudOrderStatus: async function (orderId, newStatus, adminNotes) {
            const pin = this.getAdminPin();
            const url = '/api/update-order-status';

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-pin': pin
                },
                body: JSON.stringify({
                    orderId: orderId,
                    status: newStatus,
                    adminNotes: adminNotes || ''
                })
            });

            if (!res.ok) {
                throw new Error(`Cloud update failed with status ${res.status}`);
            }

            return await res.json();
        },

        /**
         * Delete an order in Supabase via Netlify Function
         * @param {string} orderId
         * @returns {Promise<Object>}
         */
        deleteCloudOrder: async function (orderId) {
            const pin = this.getAdminPin();
            const url = '/api/delete-order';

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-pin': pin
                },
                body: JSON.stringify({ orderId: orderId })
            });

            if (!res.ok) {
                throw new Error(`Cloud delete failed with status ${res.status}`);
            }

            return await res.json();
        },

        /**
         * Check Supabase & Netlify backend health status
         * @returns {Promise<Object>}
         */
        checkCloudStatus: async function () {
            try {
                const res = await fetch('/api/status', { method: 'GET' });
                if (!res.ok) return { configured: false, online: false };
                return await res.json();
            } catch (e) {
                return { configured: false, online: false, error: e.message };
            }
        }
    };

    window.PaloraPDFOrder = PaloraPDFOrder;

})(window);
