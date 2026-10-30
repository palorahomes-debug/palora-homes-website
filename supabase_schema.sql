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
