/**
 * Netlify Serverless Function: status
 * Palora Homes - System Status & Database Connectivity Check
 * Returns health and configuration status without exposing sensitive secrets
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

    const rawUrl = (process.env.SUPABASE_URL || '').trim();
    const supabaseUrl = rawUrl.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

    if (!supabaseUrl || !supabaseKey) {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                status: 'operational',
                supabaseConfigured: false,
                message: 'Supabase credentials are not configured in Netlify environment variables.'
            })
        };
    }

    try {
        // Quick HEAD/GET request to Supabase REST endpoint to verify database connection
        const testRes = await fetch(`${supabaseUrl}/rest/v1/orders?select=id&limit=1`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });

        const isConnected = testRes.ok;
        let dbError = null;
        if (!testRes.ok) {
            dbError = await testRes.text();
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                status: 'operational',
                supabaseConfigured: true,
                supabaseConnected: isConnected,
                error: dbError ? dbError.slice(0, 100) : null
            })
        };
    } catch (err) {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                status: 'operational',
                supabaseConfigured: true,
                supabaseConnected: false,
                error: err.message
            })
        };
    }
};
