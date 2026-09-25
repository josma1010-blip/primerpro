/**
 * Copia los archivos estáticos a /public para el deploy en Netlify
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const files = [
  'index.html',
  'admin.html',
  'tienda-telcel.html',
  'pago-exitoso.html',
  'pago-fallido.html',
  'pago-pendiente.html'
];

files.forEach(file => {
  const src = path.join(root, file);
  const dest = path.join(publicDir, file);
  if (fs.existsSync(src)) {
    let content = fs.readFileSync(src, 'utf8');

    // En Netlify las APIs van a /.netlify/functions/...
    // El redirect /api/* ya lo maneja netlify.toml
    // No hace falta cambiar las rutas /api/ del frontend

    fs.writeFileSync(dest, content);
    console.log(`✓ ${file}`);
  } else {
    console.warn(`⚠ No encontrado: ${file}`);
  }
});

console.log('\nArchivos listos en /public para Netlify');
