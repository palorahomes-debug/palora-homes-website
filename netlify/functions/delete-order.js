/**
 * Netlify Serverless Function: delete-order
 * Palora Homes - Admin Order Deletion API
 * Securely deletes order record from Supabase PostgreSQL database
 * Protected by Store Administrator PIN
 */

exports.handler = async function (event, context) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-pin',
        'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'CORS OK' })
        };
    }

    if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Method Not Allowed. Use POST or DELETE.' })
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
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

    let orderId = '';
    if (event.queryStringParameters && event.queryStringParameters.orderId) {
        orderId = event.queryStringParameters.orderId;
    } else {
        try {
            const body = JSON.parse(event.body || '{}');
            orderId = body.orderId || '';
        } catch (e) {}
    }

    if (!orderId) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Missing orderId to delete.' })
        };
    }

    try {
        const deleteUrl = `${supabaseUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`;
        const delRes = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!delRes.ok) {
            const errText = await delRes.text();
            return {
                statusCode: 502,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: `Failed to delete order: ${errText}` })
            };
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                message: `Order #${orderId} was permanently deleted.`
            })
        };
    } catch (err) {
        return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: err.message })
        };
    }
};
