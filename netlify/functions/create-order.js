/**
 * Netlify Serverless Function: create-order
 * Palora Homes - Customer Order Inquiry Submission
 * Securely writes incoming order records into Supabase PostgreSQL database
 */

exports.handler = async function (event, context) {
    // 1. Handle CORS Preflight request
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-pin',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'CORS OK' })
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Method Not Allowed. Use POST.' })
        };
    }

    // 2. Validate environment configuration
    const supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/+$/, '') : '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        return {
            statusCode: 503,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                configured: false,
                error: 'Supabase credentials are not configured in Netlify environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).'
            })
        };
    }

    // 3. Parse and validate incoming order payload
    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (parseErr) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Invalid JSON payload.' })
        };
    }

    const {
        orderId,
        formattedDate,
        customer = {},
        items = [],
        status = 'Pending Confirmation'
    } = body;

    if (!orderId || typeof orderId !== 'string') {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Missing or invalid orderId.' })
        };
    }

    const customerAddress = customer.deliveryAddress || customer.address;
    if (!customer.fullName || !customer.mobileNumber || !customerAddress) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Customer details are incomplete (fullName, mobileNumber, and delivery address are required).'
            })
        };
    }

    if (!Array.isArray(items) || items.length === 0) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Order must contain at least one item.' })
        };
    }

    // 4. Calculate total pieces and subtotal accurately
    let totalPacks = 0;
    let totalPieces = 0;
    let subtotal = 0;
    let hasPrices = false;

    const parsedItems = items.map(it => {
        const qty = parseInt(it.quantity, 10) || 1;
        totalPacks += qty;

        const specs = String(it.specs || it.subtitle || '');
        let packMultiplier = 1;
        let packLabel = 'Single Piece';

        if (/pair|\b2\s*pcs\b|set of 2/i.test(specs) || /pair/i.test(it.title || '')) {
            packMultiplier = 2;
            packLabel = 'Pair (2 Pcs / pack)';
        } else if (/set of (\d+)/i.test(specs)) {
            const match = specs.match(/set of (\d+)/i);
            if (match && match[1]) {
                packMultiplier = parseInt(match[1], 10) || 1;
                packLabel = `Set of ${packMultiplier}`;
            }
        }

        const piecesForItem = qty * packMultiplier;
        totalPieces += piecesForItem;

        if (typeof it.price === 'number' && !isNaN(it.price) && it.price > 0) {
            hasPrices = true;
            subtotal += (it.price * qty);
        }

        return {
            id: it.id || null,
            title: it.title || 'Palora Home Decor Piece',
            category: it.category || it.categoryName || 'Home Decor',
            specs: specs,
            quantity: qty,
            packMultiplier: packMultiplier,
            packLabel: packLabel,
            totalPieces: piecesForItem,
            price: (typeof it.price === 'number') ? it.price : null,
            itemSubtotal: (typeof it.price === 'number') ? (it.price * qty) : null,
            image: it.image || null
        };
    });

    const now = new Date();
    const displayDate = formattedDate || (now.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata'
    }) + ' IST');

    // 5. Build Supabase Database Record matching public.orders schema
    const customerId = body.customerId || null;
    const customerEmail = customer.email || body.customerEmail || null;

    const supabasePayload = {
        order_id: orderId,
        formatted_date: displayDate,
        status: status,
        customer_id: customerId,
        customer_email: customerEmail,
        customer_name: customer.fullName.trim(),
        customer_mobile: String(customer.mobileNumber).trim(),
        delivery_address: customerAddress.trim(),
        city: (customer.city || '').trim(),
        state: (customer.state || '').trim(),
        pincode: String(customer.pincode || '').trim(),
        customer_notes: (customer.notes || '').trim() || null,
        items: parsedItems,
        distinct_products_count: parsedItems.length,
        total_packs: totalPacks,
        total_pieces: totalPieces,
        subtotal: hasPrices ? subtotal : null,
        pricing_status: hasPrices
            ? `₹${subtotal.toLocaleString('en-IN')} (Calculated Subtotal)`
            : 'Inquiry Quote — Price Confirmation Pending',
        status_history: [
            {
                status: status,
                timestamp: now.toISOString(),
                formattedDate: displayDate,
                notes: 'Customer order inquiry submitted via Palora Homes Website'
            }
        ]
    };

    // 6. Execute Supabase REST API Call (Insert with Upsert capability)
    try {
        const endpoint = `${supabaseUrl}/rest/v1/orders`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation,resolution=merge-duplicates'
            },
            body: JSON.stringify(supabasePayload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Supabase create-order error:', response.status, errText);
            return {
                statusCode: response.status >= 400 && response.status < 500 ? response.status : 502,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: `Database insertion failed: ${errText}`,
                    status: response.status
                })
            };
        }

        const data = await response.json();

        // 7. Write normalized line items to public.order_items table
        if (Array.isArray(parsedItems) && parsedItems.length > 0) {
            const lineItemsPayload = parsedItems.map(it => ({
                order_id: orderId,
                product_id: it.id || null,
                title: it.title,
                category: it.category,
                specs: it.specs,
                quantity: it.quantity,
                unit_price: it.price,
                total_price: it.itemSubtotal
            }));

            try {
                await fetch(`${supabaseUrl}/rest/v1/order_items`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(lineItemsPayload)
                });
            } catch (itemErr) {
                console.warn('Order items insert notice:', itemErr.message);
            }
        }

        return {
            statusCode: 201,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                message: 'Order saved successfully in Supabase database.',
                orderId: orderId,
                order: Array.isArray(data) ? data[0] : data
            })
        };
    } catch (fetchErr) {
        console.error('Network error reaching Supabase:', fetchErr);
        return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: `Unable to connect to Supabase: ${fetchErr.message}`
            })
        };
    }
};
