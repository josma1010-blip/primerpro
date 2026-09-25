# Desplegar ChipTelcel en Netlify

Netlify sirve archivos estáticos y **funciones serverless**. No corre `node server.js` como un VPS.

## Qué funciona en Netlify

| Función | ¿Funciona? |
|---------|------------|
| Tienda + carrito | ✅ Sí |
| Pagar con Mercado Pago | ✅ Sí (con variable de entorno) |
| Páginas de éxito/fallo | ✅ Sí |
| Webhook de pagos | ✅ Sí (logs en Netlify) |
| Panel admin completo | ⚠️ Limitado (sin base de datos los pedidos no se guardan) |

---

## Pasos para desplegar

### 1. Sube el proyecto a GitHub

1. Crea un repositorio en GitHub
2. Sube todos los archivos del ZIP (incluida la carpeta `netlify/`, `public/` se genera sola)

### 2. Conecta con Netlify

1. Entra a [app.netlify.com](https://app.netlify.com)
2. **Add new site** → **Import an existing project**
3. Elige tu repositorio de GitHub
4. Configuración de build:
   - **Build command:** `npm install && node scripts/prepare-netlify.js`
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`

O si ya tienes el `netlify.toml`, Netlify lo detecta solo.

### 3. Variables de entorno (importante)

En Netlify: **Site settings → Environment variables → Add variable**

| Variable | Valor | Obligatorio |
|----------|--------|-------------|
| `MP_ACCESS_TOKEN` | Tu token de Mercado Pago (`TEST-...` o `APP_USR-...`) | Sí (para pagos) |
| `ADMIN_USER` | Usuario del panel | No (default: admin) |
| `ADMIN_PASS` | Contraseña del panel | No (default: admin123) |
| `URL` | `https://tu-sitio.netlify.app` | Recomendado |

### 4. Deploy

Haz clic en **Deploy site**. Cuando termine, tu tienda estará en:

```
https://tu-sitio.netlify.app
```

Admin (limitado):

```
https://tu-sitio.netlify.app/admin
```

---

## Configurar Mercado Pago con tu dominio Netlify

1. En el panel de Mercado Pago → Webhooks  
2. URL: `https://tu-sitio.netlify.app/api/webhook`
3. Eventos: `payment` y `merchant_order`

---

## Panel admin en Netlify

El admin **sí carga**, pero los pedidos **no se guardan de forma permanente** porque Netlify Functions no tienen disco persistente (como el archivo `orders.json` del servidor Node).

### Opciones si necesitas admin completo:

**Opción A – Recomendada:** Despliega el backend completo en [Railway](https://railway.app) o [Render](https://render.com) (gratis) y deja solo el frontend en Netlify.

**Opción B:** Conecta una base de datos gratuita (Supabase, MongoDB Atlas, Fauna) y adapta las funciones.

---

## Resumen rápido

```bash
# En local, para probar el sitio estático:
# Solo abre index.html

# Para pagos reales en Netlify:
# 1. Sube a GitHub
# 2. Conecta Netlify
# 3. Agrega MP_ACCESS_TOKEN en Environment variables
# 4. Deploy
```

Si quieres el **panel admin completo con pedidos**, usa Railway/Render con el `server.js` original en lugar de Netlify para el backend.
