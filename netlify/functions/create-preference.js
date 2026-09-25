/**
 * Netlify Function: Crear preferencia de pago Mercado Pago
 * POST /.netlify/functions/create-preference
 * (también disponible como /api/create-preference vía redirect)
 */
const { MercadoPagoConfig, Preference } = require('mercadopago');

exports.handler = async (event) => {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Mercado Pago no configurado',
          message: 'Agrega MP_ACCESS_TOKEN en las variables de entorno de Netlify'
        })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { items, payer, shipping_cost = 0 } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Se requieren items del carrito' })
      };
    }

    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
    const preferenceClient = new Preference(client);

    const mpItems = items.map(item => ({
      id: String(item.id),
      title: item.name,
      description: item.description || item.name,
      quantity: Number(item.quantity),
      unit_price: Number(item.price),
      currency_id: 'MXN',
      category_id: 'electronics'
    }));

    if (shipping_cost > 0) {
      mpItems.push({
        id: 'shipping',
        title: 'Costo de envío',
        quantity: 1,
        unit_price: Number(shipping_cost),
        currency_id: 'MXN'
      });
    }

    const externalReference = `CHIPTELCEL-${Date.now()}`;
    // URL del sitio (Netlify la provee en el deploy, o usa la del request)
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://tu-sitio.netlify.app';

    const preferenceData = {
      items: mpItems,
      payer: {
        name: payer?.name || '',
        email: payer?.email || '',
        phone: { number: payer?.phone || '' },
        address: { street_name: payer?.address || '' }
      },
      back_urls: {
        success: `${siteUrl}/pago-exitoso.html`,
        failure: `${siteUrl}/pago-fallido.html`,
        pending: `${siteUrl}/pago-pendiente.html`
      },
      auto_return: 'approved',
      external_reference: externalReference,
      statement_descriptor: 'CHIPTELCEL',
      payment_methods: {
        installments: 12
      },
      notification_url: `${siteUrl}/api/webhook`
    };

    const result = await preferenceClient.create({ body: preferenceData });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: result.id,
        init_point: result.init_point,
        sandbox_init_point: result.sandbox_init_point,
        external_reference: externalReference
      })
    };
  } catch (error) {
    console.error('Error create-preference:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error al crear la preferencia de pago',
        details: error.message
      })
    };
  }
};
