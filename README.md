# ChipTelcel - Tienda con Mercado Pago + Webhooks

Tienda completa de chips Telcel con carrito de compras, **Mercado Pago Checkout Pro** y **webhooks de notificaciones de pago**.

## 🚀 Cómo ponerla en marcha

### 1. Requisitos
- Node.js 18 o superior
- Cuenta de vendedor en [Mercado Pago México](https://www.mercadopago.com.mx)

### 2. Configurar Mercado Pago

1. Entra a [Tus integraciones](https://www.mercadopago.com.mx/developers/panel/app)
2. Crea una aplicación (elige **Pagos online** → **Checkout Pro**)
3. Copia tu **Access Token** (empieza con `TEST-` para pruebas o `APP_USR-` para producción)

### 3. Instalar y configurar

```bash
# Instalar dependencias
npm install

# Crear archivo de configuración
cp .env.example .env

# Edita el archivo .env:
# MP_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxx
# WEBHOOK_URL=https://tu-url-publica/api/webhook   (opcional en local)
```

### 4. Ejecutar

```bash
npm start
```

Abre **http://localhost:3000**

---

## 🔔 Configurar Webhooks (notificaciones de pago)

Los webhooks permiten que Mercado Pago te avise automáticamente cuando un pago cambia de estado (aprobado, pendiente, rechazado, reembolsado).

### ¿Para qué sirven?

| Evento | Qué hace el sistema |
|--------|---------------------|
| `payment` aprobado | Marca el pedido como **pagado** y ejecuta `onPaymentApproved()` |
| `payment` pendiente | Marca como **pendiente** (OXXO, SPEI…) |
| `payment` rechazado | Marca como **fallido** |
| `merchant_order` | Útil para pagos offline; consulta los pagos asociados |

### Configuración paso a paso

#### A) En tu archivo `.env`

```env
# URL pública de tu servidor + /api/webhook
WEBHOOK_URL=https://tudominio.com/api/webhook
```

#### B) En el panel de Mercado Pago

1. Ve a [Tus integraciones](https://www.mercadopago.com.mx/developers/panel/app) → tu aplicación
2. Entra a **Webhooks** / **Notificaciones**
3. Agrega la URL: `https://tudominio.com/api/webhook`
4. Suscríbete al menos a estos eventos:
   - `payment`
   - `merchant_order` (recomendado)

También puedes dejar que el backend envíe `notification_url` al crear cada preferencia (ya está implementado).

### Probar webhooks en local (desarrollo)

Mercado Pago **no puede** llegar a `localhost`. Usa un túnel:

```bash
# Instala ngrok (https://ngrok.com)
ngrok http 3000
```

Copia la URL HTTPS que te da (ej: `https://abc123.ngrok.io`) y ponla en `.env`:

```env
WEBHOOK_URL=https://abc123.ngrok.io/api/webhook
```

Reinicia el servidor (`npm start`) y realiza un pago de prueba. Verás en la consola:

```
📩 Webhook recibido → topic: payment | id: 123456789
   🔍 Consultando pago 123456789...
   💳 Pago 123456789
      Estado: approved (accredited)
   📦 Pedido CHIPTELCEL-1727... → paid
🎉 ¡PAGO APROBADO!
```

### Consultar pedidos

```bash
# Todos los pedidos
curl http://localhost:3000/api/orders

# Un pedido específico
curl http://localhost:3000/api/orders/CHIPTELCEL-1727123456789
```

Los pedidos se guardan en `orders.json` (archivo local). En producción usa una base de datos.

### Personalizar acciones al recibir un pago

Abre `server.js` y busca las funciones:

```js
function onPaymentApproved(order, externalReference) {
  // Aquí: enviar email, activar chip, WhatsApp, etc.
}

function onPaymentPending(order, externalReference) { ... }
function onPaymentFailed(order, externalReference) { ... }
function onPaymentRefunded(order, externalReference) { ... }
```

---

## 🧪 Probar pagos (modo Test)

| Resultado     | Número de tarjeta   | CVV  | Fecha   |
|---------------|---------------------|------|---------|
| Aprobado      | 5474 9254 3267 0366 | 123  | 11/30   |
| Rechazado     | 5031 7557 3453 0604 | 123  | 11/30   |
| Pendiente     | 5094 3753 2418 8609 | 123  | 11/30   |

También puedes probar OXXO y SPEI en el entorno de pruebas.

---

## 📁 Estructura del proyecto

```
├── tienda-telcel.html      # Página principal de la tienda
├── server.js               # Backend + webhooks + preferencias
├── package.json
├── .env                    # Credenciales (NO subir a Git)
├── .env.example
├── orders.json             # Pedidos guardados (se crea solo)
├── pago-exitoso.html
├── pago-fallido.html
└── pago-pendiente.html
```

## 🔒 Seguridad

- El **Access Token** nunca se expone en el frontend.
- El webhook **siempre consulta la API** de Mercado Pago para verificar el estado real (no confía solo en el body).
- Responde `200 OK` de inmediato para evitar reintentos innecesarios.
- Mercado Pago es PCI compliant; nunca tocas datos de tarjetas.

## 🌐 Poner en producción

1. Access Token de **producción** (`APP_USR-...`)
2. Dominio con **HTTPS**
3. Configura `WEBHOOK_URL=https://tudominio.com/api/webhook` en `.env`
4. Registra el mismo webhook en el panel de Mercado Pago
5. (Recomendado) Usa una base de datos en lugar de `orders.json`
6. Despliega (Railway, Render, Fly.io, VPS, etc.)

## 💳 Métodos de pago disponibles

- Tarjetas de crédito y débito (Visa, Mastercard, Amex)
- Transferencia SPEI
- OXXO
- Saldo en cuenta Mercado Pago
- Meses sin intereses (según banco)

---

Hecho con ❤️ para vender chips Telcel de forma profesional.
