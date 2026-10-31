/**
 * Netlify Serverless Function: update-order-status
 * Palora Homes - Admin Order Status & Notes Update API
 * Updates order record and maintains audit history in Supabase
 * Protected by Store Administrator PIN
 */

exports.handler = async function (event, context) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-pin',
        'Access-Control-Allow-Methods': 'POST, PATCH, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'CORS OK' })
        };
    }

    if (event.httpMethod !== 'POST' && event.httpMethod !== 'PATCH') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Method Not Allowed. Use POST or PATCH.' })
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
    const rawUrl = (process.env.SUPABASE_URL || '').trim();
    const supabaseUrl = rawUrl.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

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

    // 3. Parse Body
    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (parseErr) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Invalid JSON body.' })
        };
    }

    const { orderId, status, adminNotes } = body;

    if (!orderId || !status) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Both orderId and status are required.' })
        };
    }

    try {
        // 4. Fetch current order to preserve history
        const getUrl = `${supabaseUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}&select=*`;
        const currentRes = await fetch(getUrl, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });

        let currentOrder = null;
        if (currentRes.ok) {
            const arr = await currentRes.json();
            if (Array.isArray(arr) && arr.length > 0) {
                currentOrder = arr[0];
            }
        }

        const now = new Date();
        const displayDate = now.toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Kolkata'
        }) + ' IST';

        let history = (currentOrder && Array.isArray(currentOrder.status_history)) ? currentOrder.status_history : [];
        history.push({
            status: status,
            timestamp: now.toISOString(),
            formattedDate: displayDate,
            notes: (adminNotes || '').trim() || `Status updated to ${status}`
        });

        const patchPayload = {
            status: status,
            status_history: history,
            updated_at: now.toISOString()
        };

        if (typeof adminNotes === 'string') {
            patchPayload.admin_notes = adminNotes.trim();
        }

        // 5. Update Order in Supabase
        const patchUrl = `${supabaseUrl}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`;
        const updateRes = await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(patchPayload)
        });

        if (!updateRes.ok) {
            const errText = await updateRes.text();
            console.error('Supabase update status error:', updateRes.status, errText);
            return {
                statusCode: 502,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: `Database update failed: ${errText}`
                })
            };
        }

        const updatedData = await updateRes.json();
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                message: `Order #${orderId} status updated to "${status}".`,
                order: Array.isArray(updatedData) ? updatedData[0] : updatedData
            })
        };
    } catch (err) {
        console.error('Error updating order in Supabase:', err);
        return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: `Unable to update order: ${err.message}`
            })
        };
    }
};
