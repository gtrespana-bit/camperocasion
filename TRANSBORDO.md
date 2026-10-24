# Transbordo a `gtrespana-bit/maquinaria-ocasion`

Rama temporal. **No fusionar.** El token de la sesión de Arena no puede escribir
en el repo `maquinaria-ocasion` (403 `Resource not accessible by integration`),
así que el clon completo viaja aquí dentro de un bundle git.

## Contenido

- `maquinaria-ocasion.bundle` — historial git completo del clon
  (commit `abb704d` "Esqueleto de MaquinariaOcasión", 675 ficheros). Incluye
  `.github/workflows/ci.yml`, cosa que no se puede empujar directamente con el
  token actual (falta el permiso `workflows`).
- Verificado en el sandbox: `tsc --noEmit`, `eslint .`, 776 tests unitarios y
  `next build` en verde; smoke HTTP de las rutas principales en 200.

## Cómo terminar el trasvase (en tu máquina, con tu credencial de GitHub)

```bash
# 1. Descargar esta rama (o solo el fichero desde la web de GitHub)
git clone --branch transbordo/maquinaria-ocasion \
  https://github.com/gtrespana-bit/camperocasion.git transbordo
cd transbordo

# 2. Restaurar el repo del clon desde el bundle
git clone maquinaria-ocasion.bundle maquinaria-ocasion
cd maquinaria-ocasion

# 3. Apuntar el remoto al repo nuevo y subirlo
git remote set-url origin https://github.com/gtrespana-bit/maquinaria-ocasion.git
git push -u origin main
```

Comprobación esperada:

```bash
gh repo view gtrespana-bit/maquinaria-ocasion --json isEmpty,pushedAt
git ls-remote origin main        # debe devolver el SHA abb704d...
```

Al hacer el primer push, la rama por defecto pasa a `main` y el CI se dispara
solo (jobs `calidad` y `sql`).

## Limpieza

Cuando el repo nuevo tenga el código, esta rama se puede borrar:

```bash
git push origin --delete transbordo/maquinaria-ocasion
```
