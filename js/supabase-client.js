/**
 * Palora Homes - Official Supabase Client SDK Wrapper
 * Secure browser client using Row Level Security (RLS) & Public Anon Key.
 * 
 * SECURITY NOTE:
 * - This file strictly uses the public SUPABASE_ANON_KEY.
 * - Under NO circumstances should SUPABASE_SERVICE_ROLE_KEY ever be stored or exposed here.
 * - All permissions and table access are governed by PostgreSQL Row Level Security (RLS).
 */

(function (window) {
    'use strict';

    // Local configuration cache key (optional for browser runtime configuration)
    const STORAGE_CONFIG_KEY = 'palora_supabase_credentials';

    let supabaseClient = null;
    let authListeners = [];

    const PaloraSupabase = {
        /**
         * Get Supabase configuration settings
         * Checks window.PALORA_CONFIG first, then localStorage
         * @returns {{ url: string, anonKey: string }}
         */
        getConfig: function () {
            let config = { url: '', anonKey: '' };

            if (window.PALORA_CONFIG && window.PALORA_CONFIG.supabase) {
                config.url = (window.PALORA_CONFIG.supabase.url || '').trim();
                config.anonKey = (window.PALORA_CONFIG.supabase.anonKey || '').trim();
            }

            // Fallback to runtime storage if not set in config.js
            if (!config.url || !config.anonKey) {
                try {
                    const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (parsed.url && parsed.anonKey) {
                            config.url = parsed.url;
                            config.anonKey = parsed.anonKey;
                        }
                    }
                } catch (e) {
                    // Ignore localStorage read errors
                }
            }

            return config;
        },

        /**
         * Save credentials in browser storage (useful for manual setup)
         * @param {string} url
         * @param {string} anonKey
         */
        saveConfig: function (url, anonKey) {
            try {
                localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify({
                    url: (url || '').trim(),
                    anonKey: (anonKey || '').trim()
                }));
                supabaseClient = null; // Re-initialize on next call
                return this.getClient() !== null;
            } catch (e) {
                console.error('PaloraSupabase: Failed to save credentials', e);
                return false;
            }
        },

        /**
         * Check if Supabase client is properly configured
         * @returns {boolean}
         */
        isConfigured: function () {
            const config = this.getConfig();
            return Boolean(config.url && config.anonKey && config.url.startsWith('http'));
        },

        /**
         * Get or initialize the Supabase client instance
         * @returns {Object|null}
         */
        getClient: function () {
            if (supabaseClient) {
                return supabaseClient;
            }

            const config = this.getConfig();
            if (!config.url || !config.anonKey) {
                return null;
            }

            if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
                console.warn('PaloraSupabase: Supabase SDK is not loaded on window. Ensure https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 is included.');
                return null;
            }

            try {
                supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true,
                        storage: window.localStorage
                    }
                });

                // Attach auth state change listener
                supabaseClient.auth.onAuthStateChange(function (event, session) {
                    authListeners.forEach(function (listener) {
                        try {
                            listener(event, session);
                        } catch (err) {
                            console.error('PaloraSupabase: Auth listener error', err);
                        }
                    });
                });

                return supabaseClient;
            } catch (err) {
                console.error('PaloraSupabase: Initialization failed', err);
                return null;
            }
        },

        /**
         * Subscribe to authentication state changes
         * @param {Function} callback (event, session) => void
         */
        onAuthStateChange: function (callback) {
            if (typeof callback === 'function') {
                authListeners.push(callback);
            }
        },

        // ====================================================================
        // AUTHENTICATION APIs (Customer & Admin)
        // ====================================================================

        /**
         * Register a new customer account
         * @param {string} email
         * @param {string} password
         * @param {Object} [metadata] { full_name, phone }
         * @returns {Promise<{ user: Object|null, error: string|null }>}
         */
        signUp: async function (email, password, metadata) {
            const client = this.getClient();
            if (!client) {
                return { user: null, error: 'Database backend not configured.' };
            }

            try {
                const res = await client.auth.signUp({
                    email: email.trim(),
                    password: password,
                    options: {
                        data: {
                            full_name: (metadata && metadata.fullName) || '',
                            phone: (metadata && metadata.phone) || '',
                            role: 'customer'
                        }
                    }
                });

                if (res.error) {
                    return { user: null, error: res.error.message };
                }

                return { user: res.data.user, session: res.data.session, error: null };
            } catch (err) {
                return { user: null, error: err.message };
            }
        },

        /**
         * Sign in with Email and Password
         * @param {string} email
         * @param {string} password
         * @returns {Promise<{ user: Object|null, session: Object|null, error: string|null }>}
         */
        signIn: async function (email, password) {
            const client = this.getClient();
            if (!client) {
                return { user: null, session: null, error: 'Database backend not configured.' };
            }

            try {
                const res = await client.auth.signInWithPassword({
                    email: email.trim(),
                    password: password
                });

                if (res.error) {
                    return { user: null, session: null, error: res.error.message };
                }

                return { user: res.data.user, session: res.data.session, error: null };
            } catch (err) {
                return { user: null, session: null, error: err.message };
            }
        },

        /**
         * Sign out current user
         * @returns {Promise<{ error: string|null }>}
         */
        signOut: async function () {
            const client = this.getClient();
            if (!client) return { error: null };

            try {
                const res = await client.auth.signOut();
                if (res.error) return { error: res.error.message };
                return { error: null };
            } catch (err) {
                return { error: err.message };
            }
        },

        /**
         * Get current session user
         * @returns {Promise<Object|null>}
         */
        getCurrentUser: async function () {
            const client = this.getClient();
            if (!client) return null;

            try {
                const res = await client.auth.getUser();
                return (res.data && res.data.user) ? res.data.user : null;
            } catch (e) {
                return null;
            }
        },

        /**
         * Get full user profile from 'profiles' table
         * @param {string} [userId] - Defaults to logged-in user
         * @returns {Promise<Object|null>}
         */
        getProfile: async function (userId) {
            const client = this.getClient();
            if (!client) return null;

            try {
                let targetId = userId;
                if (!targetId) {
                    const user = await this.getCurrentUser();
                    if (!user) return null;
                    targetId = user.id;
                }

                const res = await client
                    .from('profiles')
                    .select('*')
                    .eq('id', targetId)
                    .single();

                if (res.error) {
                    console.warn('PaloraSupabase: Failed to fetch profile', res.error.message);
                    return null;
                }

                return res.data;
            } catch (err) {
                console.error('PaloraSupabase: Profile fetch exception', err);
                return null;
            }
        },

        /**
         * Update current user profile (address, contact, name)
         * @param {Object} updates
         * @returns {Promise<{ success: boolean, error: string|null }>}
         */
        updateProfile: async function (updates) {
            const client = this.getClient();
            if (!client) return { success: false, error: 'Database backend not configured.' };

            try {
                const user = await this.getCurrentUser();
                if (!user) return { success: false, error: 'Not authenticated.' };

                const payload = Object.assign({}, updates, {
                    updated_at: new Date().toISOString()
                });

                const res = await client
                    .from('profiles')
                    .update(payload)
                    .eq('id', user.id);

                if (res.error) {
                    return { success: false, error: res.error.message };
                }

                return { success: true, error: null };
            } catch (err) {
                return { success: false, error: err.message };
            }
        },

        /**
         * Check if logged-in user has admin privileges
         * @returns {Promise<boolean>}
         */
        isAdmin: async function () {
            try {
                const profile = await this.getProfile();
                return Boolean(profile && profile.role === 'admin');
            } catch (e) {
                return false;
            }
        },

        // ====================================================================
        // CATALOG & PRODUCTS APIs (Read governed by RLS)
        // ====================================================================

        /**
         * Fetch active categories
         * @returns {Promise<Array>}
         */
        fetchCategories: async function () {
            const client = this.getClient();
            if (!client) return [];

            try {
                const res = await client
                    .from('categories')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true });

                if (res.error) {
                    console.warn('PaloraSupabase: fetchCategories error', res.error.message);
                    return [];
                }

                return res.data || [];
            } catch (err) {
                console.error('PaloraSupabase: fetchCategories exception', err);
                return [];
            }
        },

        /**
         * Fetch products with optional category filtering
         * @param {string} [categoryKey] - 'all' or specific category id
         * @returns {Promise<Array>}
         */
        fetchProducts: async function (categoryKey) {
            const client = this.getClient();
            if (!client) return [];

            try {
                let query = client
                    .from('products')
                    .select('*')
                    .eq('is_available', true)
                    .order('display_order', { ascending: true })
                    .order('created_at', { ascending: false });

                if (categoryKey && categoryKey !== 'all') {
                    query = query.eq('category_id', categoryKey);
                }

                const res = await query;
                if (res.error) {
                    console.warn('PaloraSupabase: fetchProducts error', res.error.message);
                    return [];
                }

                return res.data || [];
            } catch (err) {
                console.error('PaloraSupabase: fetchProducts exception', err);
                return [];
            }
        },

        /**
         * Fetch a single product by its ID
         * @param {string} productId
         * @returns {Promise<Object|null>}
         */
        fetchProductById: async function (productId) {
            const client = this.getClient();
            if (!client || !productId) return null;

            try {
                const res = await client
                    .from('products')
                    .select('*')
                    .eq('id', productId)
                    .single();

                if (res.error) return null;
                return res.data;
            } catch (e) {
                return null;
            }
        },

        // ====================================================================
        // ORDERS & CHECKOUT APIs (Governed by RLS)
        // ====================================================================

        /**
         * Submit an order directly to Supabase via RLS
         * (Permitted for both anon visitors and logged-in customers)
         * @param {Object} orderPayload
         * @returns {Promise<{ success: boolean, orderId: string, error: string|null }>}
         */
        createOrder: async function (orderPayload) {
            const client = this.getClient();
            if (!client) {
                return { success: false, orderId: orderPayload.orderId, error: 'Supabase client not configured.' };
            }

            try {
                const user = await this.getCurrentUser();
                const now = new Date();
                const displayDate = orderPayload.formattedDate || (now.toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Kolkata'
                }) + ' IST');

                const customer = orderPayload.customer || {};
                const customerAddress = customer.deliveryAddress || customer.address || '';

                const orderRecord = {
                    order_id: orderPayload.orderId,
                    formatted_date: displayDate,
                    status: orderPayload.status || 'Pending Confirmation',
                    customer_id: user ? user.id : null,
                    customer_email: user ? user.email : (customer.email || null),
                    customer_name: (customer.fullName || '').trim(),
                    customer_mobile: String(customer.mobileNumber || '').trim(),
                    delivery_address: customerAddress.trim(),
                    city: (customer.city || '').trim(),
                    state: (customer.state || '').trim(),
                    pincode: String(customer.pincode || '').trim(),
                    customer_notes: (customer.notes || '').trim() || null,
                    items: orderPayload.items || [],
                    distinct_products_count: (orderPayload.items || []).length,
                    total_packs: orderPayload.totalPacks || (orderPayload.items || []).reduce((s, it) => s + (parseInt(it.quantity, 10) || 1), 0),
                    total_pieces: orderPayload.totalPieces || 1,
                    subtotal: typeof orderPayload.subtotal === 'number' ? orderPayload.subtotal : null,
                    pricing_status: orderPayload.pricingStatus || 'Inquiry Quote — Price Confirmation Pending',
                    status_history: [
                        {
                            status: orderPayload.status || 'Pending Confirmation',
                            timestamp: now.toISOString(),
                            formattedDate: displayDate,
                            notes: 'Customer order inquiry submitted via Palora Homes Website'
                        }
                    ]
                };

                const res = await client
                    .from('orders')
                    .insert(orderRecord)
                    .select()
                    .single();

                if (res.error) {
                    console.error('PaloraSupabase: Order insertion error', res.error);
                    return { success: false, orderId: orderPayload.orderId, error: res.error.message };
                }

                // If items exist, insert normalized order_items
                if (Array.isArray(orderPayload.items) && orderPayload.items.length > 0) {
                    const lineItems = orderPayload.items.map(function (it) {
                        const qty = parseInt(it.quantity, 10) || 1;
                        const price = typeof it.price === 'number' ? it.price : null;
                        return {
                            order_id: orderPayload.orderId,
                            product_id: it.id || null,
                            title: it.title || 'Palora Handcrafted Decor',
                            category: it.category || 'Decor',
                            specs: it.specs || '',
                            quantity: qty,
                            unit_price: price,
                            total_price: price ? (price * qty) : null
                        };
                    });

                    await client.from('order_items').insert(lineItems);
                }

                return { success: true, orderId: orderPayload.orderId, error: null };
            } catch (err) {
                console.error('PaloraSupabase: createOrder exception', err);
                return { success: false, orderId: orderPayload.orderId, error: err.message };
            }
        },

        /**
         * Fetch current logged-in customer's order history
         * Protected by RLS: Customers can only query rows where customer_id = auth.uid()
         * @returns {Promise<Array>}
         */
        fetchCustomerOrders: async function () {
            const client = this.getClient();
            if (!client) return [];

            try {
                const user = await this.getCurrentUser();
                if (!user) return [];

                const res = await client
                    .from('orders')
                    .select('*')
                    .eq('customer_id', user.id)
                    .order('created_at', { ascending: false });

                if (res.error) {
                    console.warn('PaloraSupabase: fetchCustomerOrders error', res.error.message);
                    return [];
                }

                return res.data || [];
            } catch (err) {
                console.error('PaloraSupabase: fetchCustomerOrders exception', err);
                return [];
            }
        },

        // ====================================================================
        // ADMIN MANAGEMENT APIs (Governed by RLS - Admin Only)
        // ====================================================================

        /**
         * Upsert product (Add new or Update existing)
         * Allowed only if user is an authenticated Admin
         * @param {Object} product
         * @returns {Promise<{ success: boolean, product: Object|null, error: string|null }>}
         */
        adminSaveProduct: async function (product) {
            const client = this.getClient();
            if (!client) return { success: false, product: null, error: 'Database backend not configured.' };

            try {
                const record = Object.assign({}, product, {
                    updated_at: new Date().toISOString()
                });

                const res = await client
                    .from('products')
                    .upsert(record, { onConflict: 'id' })
                    .select()
                    .single();

                if (res.error) {
                    return { success: false, product: null, error: res.error.message };
                }

                return { success: true, product: res.data, error: null };
            } catch (err) {
                return { success: false, product: null, error: err.message };
            }
        },

        /**
         * Delete product by ID (Admin only)
         * @param {string} productId
         * @returns {Promise<{ success: boolean, error: string|null }>}
         */
        adminDeleteProduct: async function (productId) {
            const client = this.getClient();
            if (!client) return { success: false, error: 'Database backend not configured.' };

            try {
                const res = await client
                    .from('products')
                    .delete()
                    .eq('id', productId);

                if (res.error) {
                    return { success: false, error: res.error.message };
                }

                return { success: true, error: null };
            } catch (err) {
                return { success: false, error: err.message };
            }
        },

        /**
         * Upload product photo to Supabase Storage bucket 'product-images' (Admin only)
         * @param {File} file
         * @param {string} [customPath]
         * @returns {Promise<{ publicUrl: string|null, error: string|null }>}
         */
        adminUploadProductImage: async function (file, customPath) {
            const client = this.getClient();
            if (!client) return { publicUrl: null, error: 'Database backend not configured.' };

            try {
                const ext = file.name.split('.').pop();
                const cleanName = (customPath || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`)
                    .replace(/[^a-zA-Z0-9._-]/g, '_');

                const uploadRes = await client.storage
                    .from('product-images')
                    .upload(cleanName, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (uploadRes.error) {
                    return { publicUrl: null, error: uploadRes.error.message };
                }

                const urlRes = client.storage
                    .from('product-images')
                    .getPublicUrl(cleanName);

                return { publicUrl: urlRes.data.publicUrl, error: null };
            } catch (err) {
                return { publicUrl: null, error: err.message };
            }
        }
    };

    window.PaloraSupabase = PaloraSupabase;

})(window);
