/**
 * Netlify Function: Webhook de Mercado Pago
 * POST /.netlify/functions/webhook  →  /api/webhook
 */
const { MercadoPagoConfig, Payment } = require('mercadopago');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/plain'
  };

  // Responder 200 rápido
  // (en serverless procesamos en el mismo request)

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.warn('MP_ACCESS_TOKEN no configurado');
      return { statusCode: 200, headers, body: 'OK' };
    }

    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      body = {};
    }

    const topic = body?.type || event.queryStringParameters?.type || event.queryStringParameters?.topic;
    const resourceId = body?.data?.id || event.queryStringParameters?.['data.id'] || event.queryStringParameters?.id;

    console.log('Webhook:', topic, resourceId);

    if (topic === 'payment' && resourceId) {
      const client = new MercadoPagoConfig({ accessToken });
      const paymentClient = new Payment(client);
      const payment = await paymentClient.get({ id: resourceId });

      console.log('Pago:', {
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        external_reference: payment.external_reference,
        amount: payment.transaction_amount
      });

      // Aquí podrías guardar en una base de datos (Supabase, Fauna, etc.)
      // En Netlify Functions no hay disco persistente como en un VPS
    }

    return { statusCode: 200, headers, body: 'OK' };
  } catch (error) {
    console.error('Error webhook:', error.message);
    return { statusCode: 200, headers, body: 'OK' }; // Siempre 200 para evitar reintentos infinitos
  }
};
