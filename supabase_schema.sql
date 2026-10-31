-- ====================================================================
-- PALORA HOMES - OFFICIAL SUPABASE DATABASE SCHEMA
-- Production-ready, non-destructive schema with Row Level Security (RLS)
-- Execute this script in: Supabase Project -> SQL Editor -> New query -> Run
-- ====================================================================

-- Enable UUID extension for cryptographic ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 1. PROFILES TABLE (Customer & Admin Accounts linked to auth.users)
-- ====================================================================
-- Stores customer profiles and administrative roles.
-- Automatically created when a user signs up via Supabase Auth.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    delivery_address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper Function: Check if the current authenticated caller has 'admin' privileges
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Trigger Function: Automatically create a public profile entry when a new auth user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, phone, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create user registration trigger idempotently
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 2. CATEGORIES TABLE
-- ====================================================================
-- Stores product categories displayed on storefront and category filters
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,                       -- Slug format: 'wall-decor', 'wall-clock'
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,                        -- e.g. 'Wall Decor'
    plural_name TEXT,                          -- e.g. 'Wall Decor'
    tagline TEXT,                              -- Subtitle/tagline for storefront
    icon TEXT DEFAULT '📁',                    -- Category emoji / icon
    image_url TEXT,                            -- Thumbnail image URL
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed official Palora Homes categories idempotently (never deletes existing categories)
INSERT INTO public.categories (id, slug, name, plural_name, tagline, icon, display_order)
VALUES 
    ('wall-decor', 'wall-decor', 'Wall Decor', 'Wall Decor', 'Shelves, Planter Displays & Wall Accents', '🖼️', 1),
    ('wall-clock', 'wall-clock', 'Wall Clock', 'Wall Clocks', 'Handcrafted Wooden & Artisanal Pendulum Timepieces', '🕒', 2),
    ('night-lamp', 'night-lamp', 'Night Lamp', 'Night Lamps', '3D Illusion LED Night Lamps & Sacred Ambient Glows', '💡', 3),
    ('wall-hanging', 'wall-hanging', 'Wall Hanging', 'Wall Hangings', 'Auspicious Nazar Battu & Sacred Vedic Hangings', '🧿', 4),
    ('car-dashboard', 'car-dashboard', 'Car Dashboard Decore', 'Car Dashboard Decore', 'Divine Acrylic Deity Frames & Sacred Travel Companions', '🚗', 5),
    ('key-holder', 'key-holder', 'Key Holder', 'Key Holders', 'Solid Wood Organizers & Hook Racks', '🔑', 6)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    icon = EXCLUDED.icon;

-- ====================================================================
-- 3. PRODUCTS TABLE
-- ====================================================================
-- Stores handcrafted items, live prices, specifications, and stock counts
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,                                -- Unique ID matching catalog (e.g. 'wall-decor-deer')
    category_id TEXT REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL,
    category_name TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    specs TEXT,
    description TEXT,
    price NUMERIC(10, 2),                               -- Retail price in INR (can be NULL for quote-based items)
    sale_price NUMERIC(10, 2),                          -- Optional discounted price
    stock_quantity INT NOT NULL DEFAULT 10,             -- Live stock inventory
    is_available BOOLEAN NOT NULL DEFAULT TRUE,         -- Display flag for customer catalog
    status TEXT DEFAULT 'Available for Order',          -- 'Available for Order', 'Low Stock', 'Out of Stock'
    highlights JSONB DEFAULT '[]'::jsonb,               -- Array of highlight pills e.g. ["Solid Teak", "Silent Movement"]
    image_url TEXT NOT NULL,                            -- Main product image asset or storage URL
    gallery_images JSONB DEFAULT '[]'::jsonb,           -- Secondary gallery image URLs
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- 4. ORDERS TABLE (Backward-compatible with existing schema)
-- ====================================================================
-- Stores customer order inquiries, delivery info, and order statuses
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT UNIQUE NOT NULL,                       -- Format: PH-YYYYMMDD-XXXX
    created_at TIMESTAMPTZ DEFAULT NOW(),               -- UTC timestamp
    formatted_date TEXT NOT NULL,                       -- Display timestamp (IST)
    status TEXT NOT NULL DEFAULT 'Pending Confirmation',-- Pending Confirmation, Confirmed, In Packaging, Dispatched, Delivered, Cancelled
    
    -- Customer Association (Linked to auth profile when logged in; NULL for guests)
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_email TEXT,
    
    -- Customer Contact & Shipping Details
    customer_name TEXT NOT NULL,
    customer_mobile TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    customer_notes TEXT,
    
    -- Items and Calculation Totals
    items JSONB NOT NULL DEFAULT '[]'::jsonb,           -- Complete line items array with specs
    distinct_products_count INT NOT NULL DEFAULT 1,
    total_packs INT NOT NULL DEFAULT 1,
    total_pieces INT NOT NULL DEFAULT 1,
    subtotal NUMERIC(10, 2),
    pricing_status TEXT DEFAULT 'Inquiry Quote — Price Confirmation Pending',
    
    -- Administrative fields
    admin_notes TEXT,
    status_history JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Non-destructively add customer association columns if the table already existed
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- ====================================================================
-- 5. ORDER_ITEMS TABLE (Normalized table for granular inventory & analytics)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    category TEXT,
    specs TEXT,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2),
    total_price NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- 6. PERFORMANCE INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_available ON public.products (is_available);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_mobile ON public.orders (customer_mobile);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);

-- ====================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- --------------------------------------------------------------------
-- 7.1 PROFILES RLS
-- --------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Customers can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- Customers can update their own shipping address, name, and phone
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Store Administrators have full access to view and manage customer profiles
DROP POLICY IF EXISTS "Admins full access to profiles" ON public.profiles;
CREATE POLICY "Admins full access to profiles" ON public.profiles
    FOR ALL TO authenticated
    USING (public.is_admin());

-- Backend Serverless Functions (Netlify) using service_role have full access
DROP POLICY IF EXISTS "Service role full access to profiles" ON public.profiles;
CREATE POLICY "Service role full access to profiles" ON public.profiles
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------
-- 7.2 CATEGORIES RLS
-- --------------------------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Public (unauthenticated visitors and customers) can view active categories
DROP POLICY IF EXISTS "Public can view active categories" ON public.categories;
CREATE POLICY "Public can view active categories" ON public.categories
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

-- Store Administrators can add, edit, or deactivate categories
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role full access to categories" ON public.categories;
CREATE POLICY "Service role full access to categories" ON public.categories
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------
-- 7.3 PRODUCTS RLS
-- --------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Public visitors and customers can only read available products
DROP POLICY IF EXISTS "Public can view available products" ON public.products;
CREATE POLICY "Public can view available products" ON public.products
    FOR SELECT TO anon, authenticated
    USING (is_available = true);

-- Store Administrators have full CRUD access to all products (even drafts or hidden items)
DROP POLICY IF EXISTS "Admins can view and manage all products" ON public.products;
CREATE POLICY "Admins can view and manage all products" ON public.products
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role full access to products" ON public.products;
CREATE POLICY "Service role full access to products" ON public.products
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------
-- 7.4 ORDERS RLS
-- --------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow public and guest customers to submit new orders
DROP POLICY IF EXISTS "Allow public customer order submission" ON public.orders;
CREATE POLICY "Allow public customer order submission" ON public.orders
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Customers can view ONLY their own orders (based on auth.uid() matching customer_id)
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
CREATE POLICY "Customers can view their own orders" ON public.orders
    FOR SELECT TO authenticated
    USING (customer_id = auth.uid() OR public.is_admin());

-- Store Administrators can view, filter, and update all order statuses
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
CREATE POLICY "Admins can manage orders" ON public.orders
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Serverless functions using service_role have full access
DROP POLICY IF EXISTS "Service role full access to orders" ON public.orders;
CREATE POLICY "Service role full access to orders" ON public.orders
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------
-- 7.5 ORDER_ITEMS RLS
-- --------------------------------------------------------------------
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Allow order items insertion during checkout
DROP POLICY IF EXISTS "Allow insertion of order items" ON public.order_items;
CREATE POLICY "Allow insertion of order items" ON public.order_items
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Customers can view order items for their own orders
DROP POLICY IF EXISTS "Customers can view own order items" ON public.order_items;
CREATE POLICY "Customers can view own order items" ON public.order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.order_id = order_items.order_id
            AND (orders.customer_id = auth.uid() OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "Service role full access to order items" ON public.order_items;
CREATE POLICY "Service role full access to order items" ON public.order_items
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ====================================================================
-- 8. SUPABASE STORAGE (Product Images Bucket Setup & RLS)
-- ====================================================================
-- Creates the public storage bucket for high-res product photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public can view images in the bucket
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'product-images');

-- Only authenticated store administrators can upload product photos
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
CREATE POLICY "Admins can upload product images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

-- Only authenticated store administrators can update or delete product photos
DROP POLICY IF EXISTS "Admins can update and delete product images" ON storage.objects;
CREATE POLICY "Admins can update and delete product images" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'product-images' AND public.is_admin());

-- ====================================================================
-- 9. CART_ACTIVITY TABLE (Real-Time Customer Shopping Cart Tracking)
-- ====================================================================
-- Stores live customer carts (both anonymous guest sessions and logged-in users)
CREATE TABLE IF NOT EXISTS public.cart_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,                           -- Anonymous session ID (e.g. 'guest_abc123')
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_name TEXT,                                        -- Populated only when provided by customer
    customer_phone TEXT,                                       -- Populated only when provided by customer
    customer_email TEXT,                                       -- Populated only when provided by customer
    items JSONB NOT NULL DEFAULT '[]'::jsonb,                  -- Full cart items array with titles, images, quantities, specs
    total_items INT NOT NULL DEFAULT 0,
    cart_total NUMERIC(10, 2) DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_activity_session_id ON public.cart_activity (session_id);
CREATE INDEX IF NOT EXISTS idx_cart_activity_last_updated ON public.cart_activity (last_updated DESC);

ALTER TABLE public.cart_activity ENABLE ROW LEVEL SECURITY;

-- Allow anonymous visitors and authenticated customers to save/update their cart snapshot
DROP POLICY IF EXISTS "Public can upsert cart activity" ON public.cart_activity;
CREATE POLICY "Public can upsert cart activity" ON public.cart_activity
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Store Administrators have full read access to inspect active customer carts
DROP POLICY IF EXISTS "Admins can view cart activity" ON public.cart_activity;
CREATE POLICY "Admins can view cart activity" ON public.cart_activity
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- Store Administrators can delete abandoned or completed cart sessions
DROP POLICY IF EXISTS "Admins can delete cart activity" ON public.cart_activity;
CREATE POLICY "Admins can delete cart activity" ON public.cart_activity
    FOR DELETE TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access to cart activity" ON public.cart_activity;
CREATE POLICY "Service role full access to cart activity" ON public.cart_activity
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ====================================================================
-- 10. OFFICIAL 23 PALORA HOMES SIGNATURE PRODUCTS SEED (IDEMPOTENT)
-- ====================================================================
-- Safely seeds all 23 signature handcrafted products matching config.js.
-- Never creates duplicates because of ON CONFLICT (id).
INSERT INTO public.products (id, category_id, category_name, title, subtitle, specs, description, price, stock_quantity, is_available, status, highlights, image_url, display_order)
VALUES
    -- Wall Decor (3 Products)
    ('wall-decor-deer', 'wall-decor', 'Wall Decor', 'Deer Silhouette Floating Wall Shelves', 'Artisanal Living Accent & Planter Perches (Pair)', '6" x 8" (Pair) • Matte Black Finish', 'Artisanal pair of black deer head silhouette wall shelves crafted to display miniature succulent pots, tea lights, or botanical accents with organic elegance.', NULL, 15, TRUE, 'Available for Order', '["Set of 2 Shelves", "Planter Display (6\" x 8\")", "Solid Wall Mount"]'::jsonb, 'assets/images/deer-floating-shelves.jpg', 1),
    ('wall-decor-bird-circle', 'wall-decor', 'Wall Decor', 'Circular Bird Silhouette Wall Shelves', 'Solid Teak Finish Wall Sconces & Display Perches (Pair)', 'Pair (2 Pcs) • Natural Hardwood Grain', 'Handcrafted pair of circular wooden wall accent shelves featuring a precision cutout bird perched on a leafy branch, complete with a sturdy display ledge for small botanicals and candles.', NULL, 12, TRUE, 'Available for Order', '["Pair of 2 Shelves", "Carved Bird on Branch", "Solid Hardwood Craft"]'::jsonb, 'assets/images/circular-bird-wall-shelves.png', 2),
    ('wall-decor-diamond-sunburst', 'wall-decor', 'Wall Decor', 'Geometric Sunburst Diamond Wall Shelves', 'Boho Radial Lattice Shelves & Planter Ledges (Pair)', 'Pair (2 Pcs) • Laser Cut Engineered Wood', 'Striking diamond-silhouette wall shelves adorned with radial sunburst geometric cutouts and a curved wooden ledge ideal for potted succulents, air plants, and decor curios.', NULL, 10, TRUE, 'Available for Order', '["Set of 2 Shelves", "Radial Sunburst Design", "Succulent Planter Perch"]'::jsonb, 'assets/images/diamond-sunburst-wall-shelves.png', 3),

    -- Wall Clock (5 Products)
    ('wall-clock-bird-wwc102', 'wall-clock', 'Wall Clock', 'Bird Silhouette Geometric Wall Clock', 'Dual Perched Birds & Lattice Horizon', '16" x 6" (Single) • Natural Solid Wood', 'Contemporary rectangular wooden wall clock uniting warm natural wood grain with modern geometric lattice cutouts and two perched bird silhouettes. Features minimalist 12, 9, 6 bold numerals and a silent quartz precision movement.', 1899.00, 8, TRUE, 'Available for Order', '["16\" x 6\" Size", "Dual Bird Silhouettes", "Geometric Horizon Lattice", "Silent Quartz Movement"]'::jsonb, 'assets/images/wooden-bird-wall-clock.jpg', 4),
    ('wall-clock-deer-pendulum-wwc102', 'wall-clock', 'Wall Clock', 'Nordic Deer Antler Pendulum Wall Clock', 'Minimalist Dial, Antler Crown & Swinging Pendulum', '12" x 12" (Single) • Silent Quartz Movement', 'Scandinavian-style modern wall clock boasting a minimalist open-ring white dial, rich walnut center column, bold sculptural black deer antlers, and a calming swinging wooden pendulum. Engineered with ultra-quiet quartz precision.', 2199.00, 6, TRUE, 'Available for Order', '["12\" x 12\" Size", "Swinging Pendulum", "Sculptural Deer Antlers", "Silent Quartz Movement"]'::jsonb, 'assets/images/wall-clock-deer-pendulum.jpg', 5),
    ('wall-clock-modern-oval', 'wall-clock', 'Wall Clock', 'Nordic Minimalist Oval Wooden Wall Clock', 'Slim Stadium Silhouette with Natural Wood Face & Matte Black Rim', '18" x 6" • Natural Wood & Matte Black Rim', 'Sleek, architectural oval wall clock featuring a warm natural wood veneer face, bold minimalist 12 and 6 stencil typography, matte black border, and silent sweep quartz movement.', 1799.00, 10, TRUE, 'Available for Order', '["18\" x 6\" Slim Oval Design", "Natural Hardwood Texture", "Silent Sweep Quartz Movement", "Modern Architectural Accent"]'::jsonb, 'assets/images/wall-clock-modern-oval-wood.png', 6),
    ('wall-clock-lion-silhouette', 'wall-clock', 'Wall Clock', 'Majestic Lion Mane Silhouette Wall Clock', 'Bold Wildlife Profile Clock with Flowing Mane & Quiet Quartz Hands', '12" x 12" • Matte Black Engineered Craft • Quiet Movement', 'Statement wildlife silhouette wall clock capturing the noble profile of a lion with an intricately sculpted flowing mane framing a clean 12-hour numeral dial, paired with high-contrast white hands and a vibrant red second needle.', 1599.00, 14, TRUE, 'Available for Order', '["12\" x 12\" Statement Diameter", "Sculpted Lion Head Profile", "Silent Quartz Mechanism", "High-Contrast Dial & Red Needle"]'::jsonb, 'assets/images/wall-clock-lion-silhouette.png', 7),
    ('wall-clock-roman-scalloped-teak', 'wall-clock', 'Wall Clock', 'Scalloped Geometric Roman Wooden Wall Clock', 'Dual-Tone White & Teak Finish Contemporary Dial', '14" Diameter • Roman Numerals • Teak & White Finish', 'Striking 14-inch geometric wall clock featuring an eye-catching scalloped outer frame in crisp white, contrasting rich natural teak wood grain ray inserts with laser-cut Roman numerals and precision silent sweep hands.', 2499.00, 5, TRUE, 'Available for Order', '["14\" Diameter Statement Clock", "Scalloped Geometric White Rim", "Natural Teak Grain Inserts", "Silent Sweep Quartz Movement"]'::jsonb, 'assets/images/wall-clock-roman-scalloped-teak.png', 8),

    -- Night Lamp (3 Products)
    ('night-lamp-lakshmi-3d', 'night-lamp', 'Night Lamp', 'Goddess Lakshmi 3D LED Sacred Lamp', 'Divine Lotus Acrylic Illusion & Violet Glow', 'Wall Plug-in • Optical Acrylic • Violet LED', 'Exquisitely etched optical acrylic 3D night light depicting Goddess Lakshmi seated on an auspicious lotus throne with prosperity blessings. Plugs directly into standard wall sockets to radiate a peaceful violet ambient glow in your mandir, bedroom, or living sanctuary.', 899.00, 20, TRUE, 'Available for Order', '["3D Optical Illusion", "Sacred Lotus Throne", "Direct Wall Plug-in", "Peaceful Violet Glow"]'::jsonb, 'assets/images/lakshmi-3d-led-lamp.png', 9),
    ('night-lamp-heart-3d', 'night-lamp', 'Night Lamp', '3D Optical Illusion Heart LED Lamp', 'Romantic Wireframe Mesh & Crimson Tabletop Glow', 'Tabletop Stand • Crimson Red LED • 3D Illusion', 'Mesmerizing 3D optical illusion desk lamp showcasing an intricately laser-etched geometric wireframe heart on crystal-clear acrylic. Casts an enchanting, romantic crimson-red ambient glow across your bedside, workspace, or living decor.', 799.00, 18, TRUE, 'Available for Order', '["3D Wireframe Heart", "Romantic Crimson Glow", "Bedside Tabletop Stand", "Laser-Etched Acrylic"]'::jsonb, 'assets/images/heart-3d-led-lamp.png', 10),
    ('night-lamp-iloveyou-3d', 'night-lamp', 'Night Lamp', '"I LOVE YOU" 3D Wireframe Hearts LED Night Lamp', 'Mesmerizing Optical Illusion Acrylic with Violet Ambient Glow', 'Wall Plug-in • Laser-Etched Acrylic • Violet/Purple Glow', 'Enchanting direct wall socket plug-in night light boasting 3 laser-etched geometric 3D wireframe hearts with floating mini hearts and "I LOVE YOU" typography, casting a serene violet/purple ambient aura.', 849.00, 16, TRUE, 'Available for Order', '["3D Wireframe Hearts Illusion", "Direct Wall Socket Plug-in", "Gentle Violet/Purple LED Glow", "Energy Efficient & Low Heat"]'::jsonb, 'assets/images/night-lamp-iloveyou-3d-hearts.png', 11),

    -- Wall Hanging (3 Products)
    ('wall-hanging-ganesha-wh006', 'wall-hanging', 'Wall Hanging', 'Lord Ganesha Evil Eye Sacred Wall Hanging', 'Auspicious Nazar Battu & Stained Glass Art', '7" x 18" (Single) • Stained Glass Medallions • Evil Eye Amulets', 'Sacred handcrafted wall hanging uniting Lord Ganesha with protective evil eye amulets in radiant turquoise and royal blue mosaic glass medallion styling.', 699.00, 25, TRUE, 'Available for Order', '["7\" x 18\" Size", "Lord Ganesha Art", "Mosaic Glass Medallions", "Auspicious Nazar Battu"]'::jsonb, 'assets/images/ganesha-evil-eye-hanging.jpg', 12),
    ('wall-hanging-gayatri-mantra', 'wall-hanging', 'Wall Hanging', 'Sacred Gayatri Mantra Wooden Slat Hanging', 'Devanagari Vedic Chants in Multicolored Wooden Plaques', 'Multi-Tier Wooden Slat • Jute Hanging Rope', 'Vibrant multi-slat wooden wall hanging featuring the sacred Gayatri Mantra in graceful Hindi Devanagari calligraphy across six colorful weathered wood plaques joined by rustic jute rope.', 999.00, 15, TRUE, 'Available for Order', '["Gayatri Mantra Slats", "Devanagari Calligraphy", "Multi-Tier Wooden Plaques", "Positive Vastu Energy"]'::jsonb, 'assets/images/wall-hanging-gayatri-mantra-slats.png', 13),
    ('wall-hanging-krishna-mantra', 'wall-hanging', 'Wall Hanging', 'Lord Krishna Mantra Wooden Wall Hanging', 'Sacred Shloka Wooden Panels with Peacock Feather Drops', 'Multi-Tier Wooden Slats • Sacred Shloka • Jute Rope', 'Exquisite multi-tiered sacred wall hanging featuring Lord Krishna playing his divine flute surrounded by a floral peacock mandala, connected with authentic jute rope to two wooden shloka panels inscribed with Om Krishnaya Vasudevaya and 4 graceful peacock feather drops.', 1199.00, 12, TRUE, 'Available for Order', '["Lord Krishna Mandala", "Sacred Sanskrit Shlokas", "Peacock Feather Drops", "Jute Rope Wall Hanging"]'::jsonb, 'assets/images/krishna-mantra-wall-hanging.png', 14),

    -- Car Dashboard Decore (7 Products)
    ('car-dashboard-murugan-acd019', 'car-dashboard', 'Car Dashboard Decore', 'Lord Murugan Acrylic Car Dashboard Frame', 'Divine Kartikeya & Mayur with Sacred Vel', '4" x 3" (Single) • Beveled Crystal Acrylic • Car Mount', 'Crystal-clear beveled acrylic car dashboard frame featuring Lord Murugan (Kartikeya) with his divine peacock and sacred Vel spear. Includes a stable adhesive peel-and-stick base for secure vehicle placement.', 449.00, 30, TRUE, 'Available for Order', '["4\" x 3\" Size", "Peel & Stick Car Base", "Lord Murugan Deity", "Beveled Crystal Acrylic"]'::jsonb, 'assets/images/car-dashboard-murugan-acd019.jpg', 15),
    ('car-dashboard-hanuman-acd004', 'car-dashboard', 'Car Dashboard Decore', 'Lord Hanuman Kneeling Ashirwad Frame', '3D Sculpted Relief with Gada & Ram Blessing', '4" x 3" (Single) • Textured 3D Relief • Crystal Acrylic', 'Intricately detailed sculpted 3D relief depiction of Lord Hanuman kneeling in reverence holding golden Gada with protective blessing hand inscribed with "Jai Shree Ram", encased in optical crystal acrylic.', 499.00, 25, TRUE, 'Available for Order', '["4\" x 3\" Size", "Jai Shree Ram Blessing", "Sculpted Relief Finish", "Crystal Acrylic Frame"]'::jsonb, 'assets/images/car-dashboard-hanuman-acd004.png', 16),
    ('car-dashboard-hanuman-acd009', 'car-dashboard', 'Car Dashboard Decore', 'Lord Hanuman Meditating ''RAM'' Crimson Frame', 'Serene Dhyan Mudra with Sacred RAM Typography', '4" x 3" (Single) • Premium Optical Acrylic • Anti-Glare', 'Striking meditative silhouette of Lord Hanuman seated in deep dhyan posture framed against sacred bold "RAM" Devanagari typography and a rich glowing crimson red aura.', 499.00, 20, TRUE, 'Available for Order', '["4\" x 3\" Size", "Sacred ''RAM'' Typography", "Meditative Dhyan Mudra", "Premium Optical Acrylic"]'::jsonb, 'assets/images/car-dashboard-hanuman-acd009.png', 17),
    ('car-dashboard-hanuman-acd010', 'car-dashboard', 'Car Dashboard Decore', 'Lord Hanuman Radiant Warrior Acrylic Frame', 'Majestic Veer Hanuman with Golden Gada & Solar Aura', '4" x 3" (Single) • Crystal Acrylic Stand • Vehicle Mount', 'Majestic depiction of Veer Hanuman standing resolute with his golden Gada weapon amidst a blazing cosmic solar aura, protected in crystal-grade beveled acrylic.', 499.00, 20, TRUE, 'Available for Order', '["4\" x 3\" Size", "Cosmic Solar Aura", "Veer Hanuman Energy", "Vehicle Dashboard Mount"]'::jsonb, 'assets/images/car-dashboard-hanuman-acd010.jpg', 18),
    ('car-dashboard-hanuman-acd007', 'car-dashboard', 'Car Dashboard Decore', 'Meditating Lord Hanuman Acrylic Car Dashboard Frame', 'Cosmic Flame Aura & Dhyan Mudra in Beveled Crystal Frame', '4" x 3" • Crystal Acrylic Frame • Model ACD007', 'Awe-inspiring car dashboard deity frame portraying Lord Hanuman in serene meditative dhyan posture surrounded by a sacred fiery cosmic halo, protected inside an optical crystal-clear acrylic stand with secure dashboard mounting.', 499.00, 22, TRUE, 'Available for Order', '["4\" x 3\" Size (ACD007)", "Meditating Hanuman in Dhyan", "Crystal Beveled Acrylic Stand", "Firm Peel & Stick Car Base"]'::jsonb, 'assets/images/car-dashboard-hanuman-acd007.jpg', 19),
    ('car-dashboard-indian-flag-cd019', 'car-dashboard', 'Car Dashboard Decore', 'Patriotic Indian Tiranga & Monuments Car Dashboard Stand', 'Ashoka Chakra, India Gate & Taj Mahal Tricolor Stand', '3" x 4" • Acrylic & Wood Stand • Model CD019', 'Proud patriotic car dashboard ornament highlighting the waving Indian National Flag, Ashoka Chakra, India Gate, and Taj Mahal silhouettes mounted upon an ornate wooden pedestal with bold tricolor "INDIAN" lettering.', 399.00, 35, TRUE, 'Available for Order', '["3\" x 4\" Size (CD019)", "Waving Tiranga & Ashoka Chakra", "India Gate & Taj Mahal Silhouettes", "Carved Wooden Pedestal Base"]'::jsonb, 'assets/images/car-dashboard-indian-flag-cd019.png', 20),
    ('car-dashboard-shrinathji-cd026', 'car-dashboard', 'Car Dashboard Decore', 'Mere Shrinathji Meri Duniya Car Dashboard Frame', 'Divine Shrinathji Face & Kamadhenu Cows Wooden Stand', '4" x 3" • Carved Wood Stand • Model CD026', 'Divine handcrafted car dashboard centerpiece showcasing the sacred countenance of Shrinathji with jewel-encrusted peacock mukut, flanked by auspicious golden Kamadhenu cows on a rich textured oval plaque with "Mere Shrinathji, Meri Duniya" pedestal base.', 549.00, 18, TRUE, 'Available for Order', '["4\" x 3\" Size (CD026)", "Shrinathji Sacred Face & Mukut", "Twin Kamadhenu Holy Cows", "Carved Dark Pedestal Stand"]'::jsonb, 'assets/images/car-dashboard-shrinathji-cd026.jpg', 21),

    -- Key Holder (2 Products)
    ('key-holder-family-birds-kh082', 'key-holder', 'Key Holder', '"Family" Bird Silhouette Wooden Key Holder', 'Charming Twin Birds on Leafy Branch with 6 Metal Key Hooks', '6" x 8" (kh082) • Engineered Wood & 6 Metal Hooks', 'Heartwarming handcrafted wall-mount key organizer featuring graceful twin songbirds perched on a leafy branch above bold "Family" lettering, fitted with 6 heavy-duty silver ring hooks.', 599.00, 16, TRUE, 'Available for Order', '["6\" x 8\" Compact Size (kh082)", "6 Heavy-Duty Metal Key Hooks", "Twin Songbirds Silhouette", "Easy Wall Mounting"]'::jsonb, 'assets/images/key-holder-family-birds-kh082.png', 22),
    ('key-holder-home-heart-kh083', 'key-holder', 'Key Holder', '"Home" Sweet Heart Silhouette Key Holder', 'House Contour with Heart Window Cutout & 5 Heavy-Duty Hooks', '6" x 8" (kh083) • Engineered Wood & 5 Metal Hooks', 'Charming house-silhouette entryway key organizer showcasing an open heart window and elegant script "Home" lettering, complete with 5 sturdy curved metal hooks for car keys, house keys, and lanyards.', 599.00, 14, TRUE, 'Available for Order', '["6\" x 8\" Dimensions (kh083)", "5 Sturdy Silver Metal Hooks", "Heart & House Silhouette", "Sturdy Wall Flush Mount"]'::jsonb, 'assets/images/key-holder-home-heart-kh083.png', 23)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    category_id = EXCLUDED.category_id,
    category_name = EXCLUDED.category_name,
    specs = EXCLUDED.specs,
    description = EXCLUDED.description,
    price = COALESCE(public.products.price, EXCLUDED.price),
    image_url = EXCLUDED.image_url;

-- ====================================================================
-- 11. CONFIRM ADMIN EMAIL & ASSIGN STORE ADMINISTRATOR ROLE
-- ====================================================================
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'palorahomes@gmail.com';

INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Store Admin'), 'admin'
FROM auth.users
WHERE email = 'palorahomes@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';


