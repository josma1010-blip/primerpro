/**
 * ChipTelcel - Backend con Mercado Pago Checkout Pro + Webhooks
 *
 * INSTRUCCIONES:
 * 1. Crea cuenta en https://www.mercadopago.com.mx
 * 2. Tus integraciones → Crea aplicación → Checkout Pro
 * 3. Copia Access Token en .env → MP_ACCESS_TOKEN=...
 * 4. (Opcional) Configura WEBHOOK_URL para notificaciones
 * 5. npm install && npm start
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { MercadoPagoConfig, Preference, Payment, MerchantOrder } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Almacenamiento simple de pedidos (archivo JSON)
// En producción usa una base de datos real
// ============================================
const ORDERS_FILE = path.join(__dirname, 'orders.json');

function loadOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error leyendo orders.json:', e.message);
  }
  return {};
}

function saveOrders(orders) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
  } catch (e) {
    console.error('Error guardando orders.json:', e.message);
  }
}

function upsertOrder(externalReference, data) {
  const orders = loadOrders();
  orders[externalReference] = {
    ...orders[externalReference],
    ...data,
    updatedAt: new Date().toISOString()
  };
  saveOrders(orders);
  return orders[externalReference];
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // MP a veces envía form-urlencoded
app.use(express.static(path.join(__dirname)));

// Configuración de Mercado Pago
const accessToken = process.env.MP_ACCESS_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL; // ej: https://tu-dominio.com/api/webhook

if (!accessToken) {
  console.warn('\n⚠️  ADVERTENCIA: No se encontró MP_ACCESS_TOKEN en .env');
  console.warn('   Crea un archivo .env con: MP_ACCESS_TOKEN=TEST-xxxxxxxx\n');
}

const client = new MercadoPagoConfig({
  accessToken: accessToken || 'TEST-placeholder',
  options: { timeout: 10000 }
});

const preferenceClient = new Preference(client);
const paymentClient = new Payment(client);
const merchantOrderClient = new MerchantOrder(client);

// ============================================
// ENDPOINT: Crear preferencia de pago
// ============================================
app.post('/api/create-preference', async (req, res) => {
  try {
    const { items, payer, shipping_cost = 0 } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requieren items del carrito' });
    }

    if (!accessToken || accessToken === 'TEST-placeholder') {
      return res.status(500).json({
        error: 'Mercado Pago no está configurado',
        message: 'Agrega tu MP_ACCESS_TOKEN en el archivo .env'
      });
    }

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
        description: 'Envío nacional',
        quantity: 1,
        unit_price: Number(shipping_cost),
        currency_id: 'MXN',
        category_id: 'others'
      });
    }

    const externalReference = `CHIPTELCEL-${Date.now()}`;
    const host = `${req.protocol}://${req.get('host')}`;

    // Guardar pedido pendiente
    upsertOrder(externalReference, {
      status: 'pending_payment',
      items: items,
      payer: payer,
      shipping_cost: shipping_cost,
      total: items.reduce((s, i) => s + i.price * i.quantity, 0) + Number(shipping_cost),
      createdAt: new Date().toISOString()
    });

    const preferenceData = {
      items: mpItems,
      payer: {
        name: payer?.name || '',
        email: payer?.email || '',
        phone: { number: payer?.phone || '' },
        address: { street_name: payer?.address || '' }
      },
      back_urls: {
        success: `${host}/pago-exitoso.html`,
        failure: `${host}/pago-fallido.html`,
        pending: `${host}/pago-pendiente.html`
      },
      auto_return: 'approved',
      external_reference: externalReference,
      statement_descriptor: 'CHIPTELCEL',
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12
      },
      binary_mode: false
    };

    // Notificaciones: prioriza WEBHOOK_URL del .env (recomendado en producción)
    // Si no hay, usa el host actual (solo funciona si es público)
    if (webhookUrl) {
      preferenceData.notification_url = webhookUrl;
    } else if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
      preferenceData.notification_url = `${host}/api/webhook`;
    }

    const result = await preferenceClient.create({ body: preferenceData });

    // Guardar preference_id
    upsertOrder(externalReference, {
      preferenceId: result.id
    });

    console.log(`✅ Preferencia creada: ${result.id} | Ref: ${externalReference}`);

    res.json({
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
      external_reference: externalReference
    });

  } catch (error) {
    console.error('Error al crear preferencia:', error);
    res.status(500).json({
      error: 'Error al crear la preferencia de pago',
      details: error.message
    });
  }
});

// ============================================
// WEBHOOK / IPN - Notificaciones de Mercado Pago
// ============================================
/**
 * Mercado Pago puede enviar notificaciones de dos formas:
 * 1. Webhooks modernos (JSON body con type + data.id)
 * 2. IPN clásico (query params: topic + id)
 *
 * Siempre debemos consultar la API para obtener el estado real
 * (nunca confiar solo en el body de la notificación).
 */
app.post('/api/webhook', async (req, res) => {
  // Responder 200 rápido para que MP no reintente
  res.status(200).send('OK');

  try {
    // Soportar ambos formatos
    let topic = req.body?.type || req.query?.type || req.query?.topic;
    let resourceId = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;

    // Normalizar nombres antiguos de IPN
    if (topic === 'merchant_order') topic = 'merchant_order';
    if (topic === 'payment') topic = 'payment';

    console.log(`\n📩 Webhook recibido → topic: ${topic} | id: ${resourceId}`);
    console.log('   Body:', JSON.stringify(req.body));
    console.log('   Query:', JSON.stringify(req.query));

    if (!topic || !resourceId) {
      console.log('   ⚠️  Notificación sin topic o id. Se ignora.');
      return;
    }

    if (topic === 'payment') {
      await handlePaymentNotification(resourceId);
    } else if (topic === 'merchant_order' || topic === 'merchant_orders') {
      await handleMerchantOrderNotification(resourceId);
    } else {
      console.log(`   ℹ️  Topic no manejado: ${topic}`);
    }

  } catch (error) {
    console.error('❌ Error procesando webhook:', error.message);
  }
});

// También aceptar GET (algunas configuraciones de IPN usan GET)
app.get('/api/webhook', async (req, res) => {
  res.status(200).send('OK');

  try {
    const topic = req.query?.topic || req.query?.type;
    const resourceId = req.query?.id || req.query?.['data.id'];

    console.log(`\n📩 Webhook GET → topic: ${topic} | id: ${resourceId}`);

    if (topic === 'payment' && resourceId) {
      await handlePaymentNotification(resourceId);
    } else if ((topic === 'merchant_order' || topic === 'merchant_orders') && resourceId) {
      await handleMerchantOrderNotification(resourceId);
    }
  } catch (error) {
    console.error('❌ Error procesando webhook GET:', error.message);
  }
});

// --------------------------------------------
// Procesar notificación de pago
// --------------------------------------------
async function handlePaymentNotification(paymentId) {
  console.log(`   🔍 Consultando pago ${paymentId}...`);

  const payment = await paymentClient.get({ id: paymentId });

  if (!payment) {
    console.log('   ⚠️  Pago no encontrado');
    return;
  }

  const {
    id,
    status,
    status_detail,
    external_reference,
    transaction_amount,
    currency_id,
    payment_method_id,
    payment_type_id,
    payer,
    date_approved,
    date_created
  } = payment;

  console.log(`   💳 Pago ${id}`);
  console.log(`      Estado: ${status} (${status_detail})`);
  console.log(`      Monto: ${transaction_amount} ${currency_id}`);
  console.log(`      Método: ${payment_type_id} / ${payment_method_id}`);
  console.log(`      Ref externa: ${external_reference}`);

  if (!external_reference) {
    console.log('   ⚠️  Sin external_reference. No se puede asociar a un pedido.');
    return;
  }

  // Mapear estados de MP a nuestros estados
  let orderStatus = 'unknown';
  switch (status) {
    case 'approved':
      orderStatus = 'paid';
      break;
    case 'pending':
    case 'in_process':
    case 'in_mediation':
      orderStatus = 'pending';
      break;
    case 'rejected':
    case 'cancelled':
      orderStatus = 'failed';
      break;
    case 'refunded':
    case 'charged_back':
      orderStatus = 'refunded';
      break;
    default:
      orderStatus = status;
  }

  const order = upsertOrder(externalReference, {
    status: orderStatus,
    paymentId: id,
    paymentStatus: status,
    paymentStatusDetail: status_detail,
    amount: transaction_amount,
    currency: currency_id,
    paymentMethod: payment_method_id,
    paymentType: payment_type_id,
    payerEmail: payer?.email,
    dateApproved: date_approved,
    dateCreated: date_created
  });

  console.log(`   📦 Pedido ${external_reference} → ${orderStatus}`);

  // Acciones según el estado
  if (orderStatus === 'paid') {
    onPaymentApproved(order, external_reference);
  } else if (orderStatus === 'pending') {
    onPaymentPending(order, external_reference);
  } else if (orderStatus === 'failed') {
    onPaymentFailed(order, external_reference);
  } else if (orderStatus === 'refunded') {
    onPaymentRefunded(order, external_reference);
  }
}

// --------------------------------------------
// Procesar merchant_order (útil para pagos offline)
// --------------------------------------------
async function handleMerchantOrderNotification(orderId) {
  console.log(`   🔍 Consultando merchant_order ${orderId}...`);

  const merchantOrder = await merchantOrderClient.get({ merchantOrderId: orderId });

  if (!merchantOrder) {
    console.log('   ⚠️  Merchant order no encontrada');
    return;
  }

  const externalReference = merchantOrder.external_reference;
  const payments = merchantOrder.payments || [];

  console.log(`   📋 Merchant Order ${orderId} | Ref: ${externalReference}`);
  console.log(`      Pagos asociados: ${payments.length}`);
  console.log(`      Estado orden: ${merchantOrder.order_status}`);

  // Si hay pagos, procesamos el más reciente
  if (payments.length > 0) {
    const lastPayment = payments[payments.length - 1];
    if (lastPayment.id) {
      await handlePaymentNotification(lastPayment.id);
    }
  }
}

// ============================================
// Acciones de negocio (personaliza aquí)
// ============================================
function onPaymentApproved(order, externalReference) {
  console.log(`\n🎉 ¡PAGO APROBADO! Pedido: ${externalReference}`);
  console.log(`   Cliente: ${order.payer?.name || order.payerEmail}`);
  console.log(`   Total: $${order.amount || order.total} MXN`);
  console.log(`   → Aquí puedes: enviar email, activar chip, notificar por WhatsApp, etc.\n`);

  // Ejemplo: enviar correo, actualizar inventario, etc.
  // sendOrderConfirmationEmail(order);
  // activateChip(order);
}

function onPaymentPending(order, externalReference) {
  console.log(`\n⏳ Pago pendiente: ${externalReference}`);
  console.log(`   Método: ${order.paymentType} / ${order.paymentMethod}`);
  console.log(`   → Esperando confirmación (OXXO, SPEI, etc.)\n`);
}

function onPaymentFailed(order, externalReference) {
  console.log(`\n❌ Pago fallido: ${externalReference}`);
  console.log(`   Detalle: ${order.paymentStatusDetail}\n`);
}

function onPaymentRefunded(order, externalReference) {
  console.log(`\n↩️  Pago reembolsado: ${externalReference}\n`);
}

// ============================================
// API de pedidos (pública - solo lectura por ref)
// ============================================
app.get('/api/orders', (req, res) => {
  const orders = loadOrders();
  res.json(orders);
});

app.get('/api/orders/:ref', (req, res) => {
  const orders = loadOrders();
  const order = orders[req.params.ref];
  if (!order) {
    return res.status(404).json({ error: 'Pedido no encontrado' });
  }
  res.json(order);
});

// ============================================
// ADMIN AUTH + PANEL
// ============================================
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
// Token simple en memoria (para producción usa JWT real)
const validTokens = new Set();

function generateToken() {
  return 'adm_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token || !validTokens.has(token)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = generateToken();
    validTokens.add(token);
    // Limpiar tokens viejos si hay muchos
    if (validTokens.size > 50) {
      const arr = [...validTokens];
      arr.slice(0, 25).forEach(t => validTokens.delete(t));
    }
    console.log(`👤 Admin login exitoso: ${username}`);
    return res.json({ token, user: username });
  }
  res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
});

app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  res.json(loadOrders());
});

app.patch('/api/admin/orders/:ref', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  const allowed = ['pending_payment', 'pending', 'paid', 'failed', 'refunded'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const orders = loadOrders();
  if (!orders[req.params.ref]) {
    return res.status(404).json({ error: 'Pedido no encontrado' });
  }
  const updated = upsertOrder(req.params.ref, { status, manualUpdate: true });
  console.log(`👤 Admin actualizó pedido ${req.params.ref} → ${status}`);
  res.json(updated);
});

// ============================================
// Health check
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mercadoPagoConfigured: !!(accessToken && accessToken !== 'TEST-placeholder'),
    mode: accessToken?.startsWith('TEST-') ? 'test' : 'production',
    webhookConfigured: !!webhookUrl,
    webhookUrl: webhookUrl || null
  });
});

// Servir páginas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/pago-exitoso.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pago-exitoso.html'));
});

app.get('/pago-fallido.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pago-fallido.html'));
});

app.get('/pago-pendiente.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pago-pendiente.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor ChipTelcel corriendo en http://localhost:${PORT}`);
  console.log(`📦 Mercado Pago: ${accessToken ? (accessToken.startsWith('TEST-') ? 'Modo TEST' : 'Modo PRODUCCIÓN') : 'NO CONFIGURADO'}`);
  console.log(`🔔 Webhook URL: ${webhookUrl || '(no configurada - se usará el host si no es localhost)'}`);
  console.log(`\n📖 Tienda:     http://localhost:${PORT}`);
  console.log(`🎛️  Admin:      http://localhost:${PORT}/admin`);
  console.log(`   Usuario:    ${ADMIN_USER}`);
  console.log(`📋 Pedidos:    http://localhost:${PORT}/api/orders`);
  console.log(`❤️  Health:     http://localhost:${PORT}/api/health\n`);
});
