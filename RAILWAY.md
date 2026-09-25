# Desplegar ChipTelcel en Railway

Railway sí corre el servidor Node.js completo (`server.js`).  
Funciona: tienda, Mercado Pago, webhooks y **panel admin con pedidos**.

---

## Requisitos

- Cuenta en [railway.app](https://railway.app) (puedes entrar con GitHub)
- Cuenta de Mercado Pago con Access Token
- El proyecto en un repositorio de GitHub (recomendado)

---

## Paso 1: Sube el proyecto a GitHub

1. Crea un repositorio nuevo en GitHub
2. Sube estos archivos (los del ZIP):

```
index.html
admin.html
server.js
package.json
.env.example
pago-exitoso.html
pago-fallido.html
pago-pendiente.html
README.md
```

No hace falta la carpeta `netlify/` para Railway.

---

## Paso 2: Crear el proyecto en Railway

1. Entra a [railway.app](https://railway.app) e inicia sesión
2. Clic en **New Project**
3. Elige **Deploy from GitHub repo**
4. Autoriza GitHub si te lo pide
5. Selecciona el repositorio de ChipTelcel
6. Railway detectará Node.js y usará `npm start` automáticamente

---

## Paso 3: Variables de entorno

En tu servicio de Railway:

1. Ve a la pestaña **Variables**
2. Agrega estas variables:

| Variable | Valor | Ejemplo |
|----------|--------|---------|
| `MP_ACCESS_TOKEN` | Token de Mercado Pago | `TEST-xxxx` o `APP_USR-xxxx` |
| `ADMIN_USER` | Usuario del panel | `admin` |
| `ADMIN_PASS` | Contraseña segura | `TuClaveSegura123` |
| `WEBHOOK_URL` | (se completa en el paso 5) | `https://xxx.up.railway.app/api/webhook` |
| `PORT` | Railway lo asigna solo | No hace falta ponerlo |

Guarda los cambios. Railway redesplegará solo.

---

## Paso 4: Generar dominio público

1. En tu servicio → pestaña **Settings**
2. Busca **Networking** / **Public Networking**
3. Clic en **Generate Domain**
4. Te dará una URL tipo:

```
https://chiptelcel-production-xxxx.up.railway.app
```

Copia esa URL.

---

## Paso 5: Configurar el webhook

1. Vuelve a **Variables** en Railway
2. Edita o agrega:

```
WEBHOOK_URL=https://TU-DOMINIO.up.railway.app/api/webhook
```

(Usa el dominio del paso 4)

3. En el panel de Mercado Pago → Webhooks:
   - URL: `https://TU-DOMINIO.up.railway.app/api/webhook`
   - Eventos: `payment` y `merchant_order`

---

## Paso 6: Entrar a tu tienda

| Qué | URL |
|-----|-----|
| **Tienda** | `https://TU-DOMINIO.up.railway.app` |
| **Admin** | `https://TU-DOMINIO.up.railway.app/admin` |

Login admin:
- Usuario: el de `ADMIN_USER` (por defecto `admin`)
- Contraseña: el de `ADMIN_PASS` (por defecto `admin123`)

---

## Comprobar que todo está bien

Abre en el navegador:

```
https://TU-DOMINIO.up.railway.app/api/health
```

Deberías ver algo como:

```json
{
  "status": "ok",
  "mercadoPagoConfigured": true,
  "mode": "test",
  "webhookConfigured": true
}
```

---

## Probar un pago

1. Entra a la tienda
2. Agrega un chip al carrito
3. Completa el checkout
4. Usa una tarjeta de prueba de Mercado Pago:

| Resultado | Tarjeta | CVV | Fecha |
|-----------|---------|-----|-------|
| Aprobado | 5474 9254 3267 0366 | 123 | 11/30 |

5. Revisa el pedido en `/admin`

---

## Si algo falla

| Problema | Qué revisar |
|----------|-------------|
| Sitio no carga | Logs en Railway → pestaña **Deployments** / **Logs** |
| Error al pagar | Variable `MP_ACCESS_TOKEN` bien puesta |
| Admin no deja entrar | `ADMIN_USER` y `ADMIN_PASS` en Variables |
| Webhook no llega | `WEBHOOK_URL` con HTTPS y dominio correcto de Railway |
| Build falla | Que exista `package.json` y `server.js` en la raíz del repo |

---

## Resumen

1. Repo en GitHub  
2. New Project en Railway → Deploy from GitHub  
3. Variables: `MP_ACCESS_TOKEN`, `ADMIN_USER`, `ADMIN_PASS`  
4. Generate Domain  
5. `WEBHOOK_URL` = `https://tu-dominio/api/webhook`  
6. Tienda en la URL de Railway, admin en `/admin`
