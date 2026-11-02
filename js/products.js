/**
 * Palora Homes - Products & Collections Data & Category Engine
 * Manages products by category, category metadata, and category-cart operations
 */

(function (window) {
    'use strict';

    const CATEGORY_META = {
        'wall-clock': {
            id: 'wall-clock',
            name: 'Wall Clock',
            plural: 'Wall Clocks',
            icon: '🕒',
            tagline: 'Handcrafted Wooden & Artisanal Pendulum Timepieces',
            accentColor: '#C59B3F'
        },
        'key-holder': {
            id: 'key-holder',
            name: 'Key Holder',
            plural: 'Key Holders',
            icon: '🔑',
            tagline: 'Solid Wood Organizers & Silhouette Hook Racks',
            accentColor: '#5B7444'
        },
        'night-lamp': {
            id: 'night-lamp',
            name: 'Night Lamp',
            plural: 'Night Lamps',
            icon: '💡',
            tagline: '3D Illusion LED Night Lamps & Sacred Ambient Glows',
            accentColor: '#9333EA'
        },
        'wall-decor': {
            id: 'wall-decor',
            name: 'Wall Decor',
            plural: 'Wall Decor',
            icon: '🖼️',
            tagline: 'Shelves, Planter Displays & Wall Accents',
            accentColor: '#B45309'
        },
        'wall-hanging': {
            id: 'wall-hanging',
            name: 'Wall Hanging',
            plural: 'Wall Hangings',
            icon: '🧿',
            tagline: 'Auspicious Nazar Battu & Sacred Vedic Hangings',
            accentColor: '#0284C7'
        },
        'car-dashboard': {
            id: 'car-dashboard',
            name: 'Car Dashboard Decore',
            plural: 'Car Dashboard Decore',
            icon: '🚗',
            tagline: 'Divine Acrylic Deity Frames & Sacred Travel Companions',
            accentColor: '#D97706'
        }
    };

    let cloudProductsCache = null;

    const PaloraProducts = {
        /**
         * Category metadata dictionary
         */
        categoriesMeta: CATEGORY_META,

        /**
         * Asynchronously fetch products from Supabase database
         * Falls back to PALORA_CONFIG.upcomingCollections if offline or empty
         * @returns {Promise<Array>}
         */
        loadProductsFromCloud: async function () {
            if (window.PaloraSupabase && window.PaloraSupabase.isConfigured()) {
                try {
                    const cloudItems = await window.PaloraSupabase.fetchProducts();
                    if (Array.isArray(cloudItems) && cloudItems.length > 0) {
                        cloudProductsCache = cloudItems.map(function (row) {
                            return {
                                id: row.id,
                                category: row.category_id,
                                categoryName: row.category_name || (CATEGORY_META[row.category_id] ? CATEGORY_META[row.category_id].name : 'Handcrafted'),
                                title: row.title,
                                subtitle: row.subtitle || '',
                                specs: row.specs || '',
                                image: row.image_url,
                                description: row.description || '',
                                price: null, // Inquiry Quote based catalog - all prices removed
                                salePrice: null,
                                stockQuantity: typeof row.stock_quantity === 'number' ? row.stock_quantity : 10,
                                status: row.status || (row.is_available ? 'Available for Order' : 'Out of Stock'),
                                highlights: Array.isArray(row.highlights) ? row.highlights : []
                            };
                        });

                        // Notify application of live products update
                        window.dispatchEvent(new CustomEvent('palora:products-loaded', { detail: { products: cloudProductsCache } }));
                        return cloudProductsCache;
                    }
                } catch (err) {
                    console.info('PaloraProducts: Cloud fetch failed; using local catalog fallback.', err.message);
                }
            }

            return this.getAllProducts();
        },

        /**
         * Get full product catalog from cache or PALORA_CONFIG
         * @returns {Array}
         */
        getAllProducts: function () {
            if (Array.isArray(cloudProductsCache) && cloudProductsCache.length > 0) {
                return cloudProductsCache;
            }
            if (window.PALORA_CONFIG && Array.isArray(window.PALORA_CONFIG.upcomingCollections)) {
                return window.PALORA_CONFIG.upcomingCollections;
            }
            return [];
        },

        /**
         * Get products filtered by category key
         * @param {string} categoryKey
         * @returns {Array}
         */
        getProductsByCategory: function (categoryKey) {
            const all = this.getAllProducts();
            if (!categoryKey || categoryKey === 'all') return all;
            return all.filter(function (p) {
                return p.category === categoryKey;
            });
        },

        /**
         * Get category metadata
         * @param {string} categoryKey
         * @returns {Object}
         */
        getCategoryMeta: function (categoryKey) {
            return CATEGORY_META[categoryKey] || {
                id: categoryKey,
                name: categoryKey,
                plural: categoryKey,
                icon: '📁',
                accentColor: '#C59B3F'
            };
        },

        /**
         * Put items into cart according to categories
         * Adds specified product IDs or the 5 user-provided category showcase items
         * @param {Array<string>} [productIds]
         * @returns {number} count of items added
         */
        putIntoCartByCategories: function (productIds) {
            if (!window.PaloraCart) {
                console.error('PaloraProducts: PaloraCart not loaded');
                return 0;
            }

            const config = window.PALORA_CONFIG || {};
            const targetIds = productIds || config.defaultCategoryCartProductIds || [
                'wall-clock-roman-scalloped-teak',
                'wall-hanging-krishna-mantra',
                'car-dashboard-hanuman-acd007',
                'car-dashboard-indian-flag-cd019',
                'car-dashboard-shrinathji-cd026'
            ];

            let addedCount = 0;
            targetIds.forEach(function (id) {
                const res = window.PaloraCart.addToCart(id, 1);
                if (res) addedCount++;
            });

            return addedCount;
        }
    };

    window.PaloraProducts = PaloraProducts;

})(window);
