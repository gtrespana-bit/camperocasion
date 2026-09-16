const fs = require('fs');

function updateFile(filePath, namespace, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes("import { useTranslations } from 'next-intl';")) {
    content = content.replace(/^(import .+)/m, "$1\nimport { useTranslations } from 'next-intl';");
  }
  
  const funcMatch = content.match(/export default function\s+\w+\s*\([^)]*\)\s*\{/);
  if (funcMatch && !content.includes(`const t = useTranslations('${namespace}');`)) {
    content = content.replace(funcMatch[0], funcMatch[0] + `\n  const t = useTranslations('${namespace}');`);
  }
  
  for (const [oldStr, newStr] of Object.entries(replacements)) {
    const escapedOldStr = oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedOldStr, 'g');
    content = content.replace(regex, newStr);
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated: ${filePath}`);
}

updateFile(
  'C:\\Users\\kr-im\\.openclaw\\workspace\\Marketplace-vzla\\src\\app\\[locale]\\(auth)\\login\\page.tsx',
  'auth.login',
  {
    'Iniciar sesión': "{t('title')}",
    'Correo electrónico': "{t('email')}",
    'Contraseña': "{t('password')}",
    '¿No tienes una cuenta?': "{t('no_account')}",
    'Regístrate': "{t('register')}",
    '¿Olvidaste tu contraseña?': "{t('forgot_password')}",
    '¿No recibiste el email de confirmación?': "{t('resend_prompt')}",
    'Reenviarlo': "{t('resend')}",
    'Email reenviado con éxito': "{t('resend_success')}",
    'Hemos enviado un nuevo email de confirmación a': "{t('resend_success_desc')}"
  }
);

updateFile(
  'C:\\Users\\kr-im\\.openclaw\\workspace\\Marketplace-vzla\\src\\app\\[locale]\\(auth)\\register\\page.tsx',
  'auth.register',
  {
    'Crear cuenta': "{t('title')}",
    'Nombre completo': "{t('name')}",
    'Correo electrónico': "{t('email')}",
    'Teléfono': "{t('phone')}",
    'Contraseña': "{t('password')}",
    'Repetir contraseña': "{t('repeat_password')}",
    'Estado': "{t('state')}",
    'Ciudad': "{t('city')}",
    'Registrarse': "{t('submit')}",
    '¿Ya tienes una cuenta?': "{t('has_account')}",
    'Inicia sesión': "{t('login')}",
    'Las contraseñas no coinciden': "{t('password_mismatch')}"
  }
);

updateFile(
  'C:\\Users\\kr-im\\.openclaw\\workspace\\Marketplace-vzla\\src\\app\\[locale]\\(auth)\\confirmacion\\page.tsx',
  'auth.confirmacion',
  {
    '¡Casi listo!': "{t('title')}",
    'Hemos enviado un correo de confirmación a': "{t('sent_to')}",
    'Por favor, revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación.': "{t('instructions')}",
    'Ya confirmé mi cuenta': "{t('confirmed')}",
    'Cuando recibas el email, confirma tu cuenta y luego regresa a hacer login.': "{t('footer')}"
  }
);

console.log('All files updated successfully.');