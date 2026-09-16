# Política de Seguridad de Base de Datos (RLS)

Este documento describe las políticas de Row Level Security (RLS) implementadas en el proyecto Marketplace VZLA.

## Tablas con RLS Habilitado

### 1. Tabla `perfiles`
- **Propósito**: Almacenar información del usuario
- **Políticas**:
  - `Ver perfiles`: Todos pueden ver perfiles (SELECT usando `true`)
  - `Editar propio perfil`: Solo el dueño puede editar su perfil (UPDATE usando `auth.uid() = id`)

### 2. Tabla `productos`
- **Propósito**: Almacenar productos publicados por los usuarios
- **Políticas**:
  - `Ver productos`: Solo productos activos son visibles públicamente (SELECT usando `activo = true`)
  - `Ver propios`: El dueño puede ver todos sus productos (SELECT usando `auth.uid() = user_id`)
  - `Insert propios`: Solo el dueño puede crear productos (INSERT con `auth.uid() = user_id`)
  - `Editar propios`: Solo el dueño puede editar sus productos (UPDATE usando `auth.uid() = user_id`)
  - `Eliminar propios`: Solo el dueño puede eliminar sus productos (DELETE usando `auth.uid() = user_id`)

### 3. Tabla `favoritos`
- **Propósito**: Almacenar productos favoritos de los usuarios
- **Políticas**:
  - `Ver favoritos propios`: Solo el dueño puede ver sus favoritos (SELECT usando `auth.uid() = user_id`)
  - `Insert favoritos propios`: Solo el dueño puede crear favoritos (INSERT con `auth.uid() = user_id`)
  - `Eliminar favoritos propios`: Solo el dueño puede eliminar favoritos (DELETE usando `auth.uid() = user_id`)

### 4. Tabla `mensajes`
- **Propósito**: Almacenar mensajes del sistema de chat
- **Políticas**:
  - `Ver mensajes`: Solo remitente o destinatario pueden ver mensajes (SELECT usando `auth.uid() = remitente_id OR auth.uid() = destinatario_id`)
  - `Enviar mensajes`: Solo el remitente puede enviar mensajes (INSERT con `auth.uid() = remitente_id`)

### 5. Tabla `transacciones_creditos`
- **Propósito**: Almacenar transacciones de créditos del sistema
- **Políticas**:
  - `Ver transacciones propias`: Solo el dueño puede ver sus transacciones (SELECT usando `auth.uid() = user_id`)
  - `Insert propias`: Solo el dueño puede crear transacciones (INSERT con `auth.uid() = user_id`)

## Uso de Service Role Key

La `SUPABASE_SERVICE_ROLE_KEY` se utiliza en operaciones administrativas que requieren privilegios elevados y deben evitar las restricciones de RLS:

- `/api/admin/*` - Operaciones administrativas
- `/api/chat/review-status` - Verificación de permisos para reseñas
- `/api/user-bulk` - Operaciones masivas de usuarios
- `/api/mensajes-leidos` - Marcar mensajes como leídos

## Principios de Seguridad

1. **Principio de mínimo privilegio**: Cada usuario solo puede acceder a sus propios datos
2. **Separación clara de responsabilidades**: Usuarios regulares vs administradores
3. **Uso seguro del service role**: Solo en backend, nunca expuesto en frontend
4. **Políticas bien definidas**: Cada tabla tiene políticas apropiadas para su caso de uso

## Consideraciones de Seguridad

- Las políticas RLS están bien implementadas y protegen adecuadamente los datos sensibles
- El uso del service role está limitado a operaciones que realmente lo requieren
- No se exponen credenciales sensibles en el frontend