/**
 * Netlify Serverless Function: get-orders
 * Palora Homes - Admin Orders Retrieval API
 * Securely queries Supabase PostgreSQL database using service_role credentials
 * Protected by Store Administrator PIN
 */

exports.handler = async function (event, context) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-pin',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'CORS OK' })
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Method Not Allowed. Use GET.' })
        };
    }

    // 1. PIN Security Authentication Check
    const configuredPin = process.env.ADMIN_PIN || 'palora2026';
    const providedPin = event.headers['x-admin-pin'] ||
                        event.headers['X-Admin-Pin'] ||
                        (event.queryStringParameters && event.queryStringParameters.pin) ||
                        '';

    if (String(providedPin).trim() !== String(configuredPin).trim()) {
        return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                authenticated: false,
                error: 'Unauthorized: Invalid or missing administrator PIN.'
            })
        };
    }

    // 2. Validate Supabase Configuration
    const supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/+$/, '') : '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        return {
            statusCode: 503,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                configured: false,
                error: 'Supabase credentials are not configured in Netlify environment variables.'
            })
        };
    }

    // 3. Parse Query Filters
    const params = event.queryStringParameters || {};
    const searchQuery = (params.query || '').trim();
    const statusFilter = (params.status || 'all').trim();
    const limit = Math.min(parseInt(params.limit, 10) || 100, 200);

    // 4. Construct Supabase PostgREST query parameters
    const queryParams = [
        'select=*',
        'order=created_at.desc',
        `limit=${limit}`
    ];

    if (statusFilter && statusFilter.toLowerCase() !== 'all') {
        queryParams.push(`status=eq.${encodeURIComponent(statusFilter)}`);
    }

    if (searchQuery) {
        const cleanDigits = searchQuery.replace(/\D/g, '');
        // Search across order_id, customer_name, customer_mobile, and city
        const conditions = [
            `order_id.ilike.*${encodeURIComponent(searchQuery)}*`,
            `customer_name.ilike.*${encodeURIComponent(searchQuery)}*`,
            `city.ilike.*${encodeURIComponent(searchQuery)}*`
        ];
        if (cleanDigits.length >= 3) {
            conditions.push(`customer_mobile.ilike.*${encodeURIComponent(cleanDigits)}*`);
        }
        queryParams.push(`or=(${conditions.join(',')})`);
    }

    const endpoint = `${supabaseUrl}/rest/v1/orders?${queryParams.join('&')}`;

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Supabase get-orders error:', response.status, errText);
            return {
                statusCode: 502,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: `Database query failed: ${errText}`
                })
            };
        }

        const data = await response.json();

        // 5. Map database records to frontend friendly format
        const orders = (Array.isArray(data) ? data : []).map(row => ({
            id: row.id,
            orderId: row.order_id,
            createdAt: row.created_at,
            formattedDate: row.formatted_date,
            status: row.status,
            customer: {
                fullName: row.customer_name,
                mobileNumber: row.customer_mobile,
                deliveryAddress: row.delivery_address,
                address: row.delivery_address,
                city: row.city,
                state: row.state,
                pincode: row.pincode,
                notes: row.customer_notes || ''
            },
            items: row.items || [],
            distinctProductsCount: row.distinct_products_count,
            totalPacks: row.total_packs,
            totalPieces: row.total_pieces,
            subtotal: row.subtotal,
            pricingStatus: row.pricing_status,
            adminNotes: row.admin_notes || '',
            statusHistory: row.status_history || [],
            updatedAt: row.updated_at
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                count: orders.length,
                orders: orders
            })
        };
    } catch (fetchErr) {
        console.error('Network error fetching orders from Supabase:', fetchErr);
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
