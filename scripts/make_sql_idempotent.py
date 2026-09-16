#!/usr/bin/env python3
"""Hace setup-camperocasion.sql (y las migrations sueltas) idempotente:
- CREATE POLICY  -> añade DROP POLICY IF EXISTS previo (si no existe ya)
- CREATE TRIGGER -> añade DROP TRIGGER IF EXISTS previo (si no existe ya)
- CREATE TABLE   -> añade IF NOT EXISTS (salvo si hay DROP TABLE previo)
- CREATE INDEX   -> añade IF NOT EXISTS
- CREATE FUNCTION-> añade OR REPLACE
- ADD COLUMN     -> añade IF NOT EXISTS
- ADD CONSTRAINT -> añade DROP CONSTRAINT IF EXISTS previo (si no existe ya)
"""
import re
import sys
from pglast import parse_sql
from pglast.ast import (
    CreatePolicyStmt, CreateTrigStmt, CreateStmt, CreateFunctionStmt,
    IndexStmt, AlterTableStmt,
)
from pglast.enums import AlterTableType


def split_statements(sql):
    stmts, i, n, start = [], 0, len(sql), 0
    while i < n:
        c = sql[i]
        if sql[i:i+2] == '--':
            j = sql.find('\n', i)
            i = n if j == -1 else j + 1
        elif sql[i:i+2] == '/*':
            j = sql.find('*/', i + 2)
            i = n if j == -1 else j + 2
        elif c == "'":
            i += 1
            while i < n:
                if sql[i] == "'":
                    if i + 1 < n and sql[i+1] == "'":
                        i += 2
                    else:
                        i += 1
                        break
                else:
                    i += 1
        elif c == '"':
            i += 1
            while i < n:
                if sql[i] == '"':
                    if i + 1 < n and sql[i+1] == '"':
                        i += 2
                    else:
                        i += 1
                        break
                else:
                    i += 1
        elif c == '$':
            m = re.match(r'\$[A-Za-z_]*\$', sql[i:])
            if m:
                tag = m.group(0)
                j = sql.find(tag, i + len(tag))
                i = n if j == -1 else j + len(tag)
            else:
                i += 1
        elif c == ';':
            stmts.append((start, i + 1))
            i += 1
            start = i
        else:
            i += 1
    if sql[start:].strip():
        stmts.append((start, len(sql)))
    return stmts


def q(ident):
    return '"' + ident.replace('"', '""') + '"'


def relname(rel):
    if rel.schemaname:
        return f'{q(rel.schemaname)}.{q(rel.relname)}'
    return q(rel.relname)


def leading_ws(src, off):
    line_start = src.rfind('\n', 0, off) + 1
    return src[line_start:off]


def transform(path, dry=False):
    src = open(path, encoding='utf-8').read()
    stmts = split_statements(src)
    edits = []  # (offset, old_text, new_text) aplicados en orden descendente

    for idx, (start, end) in enumerate(stmts):
        stmt = src[start:end]
        if not stmt.strip():
            continue
        prev_start = stmts[idx - 1][0] if idx > 0 else 0
        window = src[prev_start:start]  # texto (comentarios incl.) desde el statement anterior

        try:
            tree = parse_sql(stmt)
        except Exception:
            continue
        for raw in tree:
            st = getattr(raw, 'stmt', raw)

            if isinstance(st, CreatePolicyStmt):
                table = relname(st.table)
                drop = f'DROP POLICY IF EXISTS {q(st.policy_name)} ON {table};'
                if drop.lower() not in window.lower():
                    edits.append((start, '', f'\n{drop}\n'))

            elif isinstance(st, CreateTrigStmt):
                table = relname(st.relation)
                drop = f'DROP TRIGGER IF EXISTS {q(st.trigname)} ON {table};'
                if drop.lower() not in window.lower():
                    edits.append((start, '', f'\n{drop}\n'))

            elif isinstance(st, CreateStmt):
                if not st.if_not_exists:
                    # ¿hay drop table previo de esta misma tabla?
                    rel = relname(st.relation)
                    if not re.search(r'drop\s+table\s+if\s+exists\s+' + re.escape(rel) + r'\b',
                                     window, re.I):
                        m = re.match(r'(\s*)CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)', stmt, re.I)
                        if m:
                            edits.append((start + len(m.group(1)), '',
                                          'CREATE TABLE IF NOT EXISTS ' + stmt[m.end():]))

            elif isinstance(st, CreateFunctionStmt):
                if not st.replace:
                    m = re.match(r'(\s*)CREATE\s+(?!OR\s+REPLACE)FUNCTION', stmt, re.I)
                    if m:
                        edits.append((start, stmt[m.group(1).__len__():m.end()],
                                      'CREATE OR REPLACE FUNCTION'))

            elif isinstance(st, IndexStmt):
                if not st.if_not_exists and st.idxname:
                    m = re.match(r'(\s*)CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)', stmt, re.I)
                    if m:
                        edits.append((start + m.group(1).__len__(),
                                      stmt[len(m.group(1)):m.end()],
                                      f'CREATE {m.group(2) or ""}INDEX IF NOT EXISTS '))

            elif isinstance(st, AlterTableStmt):
                table = relname(st.relation)
                for cmd in st.cmds or []:
                    if cmd.subtype == AlterTableType.AT_AddColumn and not cmd.missing_ok:
                        # insertar IF NOT EXISTS tras ADD COLUMN en el texto
                        m = re.search(r'\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)', stmt, re.I)
                        if m:
                            new = m.group(0) + 'IF NOT EXISTS '
                            edits.append((start + m.start(), m.group(0), new))
                    if cmd.subtype == AlterTableType.AT_AddConstraint:
                        conname = getattr(getattr(cmd, 'def', None), 'conname', None)
                        if conname:
                            drop = f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {q(conname)};'
                            if drop.lower() not in window.lower():
                                ws = leading_ws(src, start)
                                edits.append((start, '', f'{drop}\n{ws}'))

    # aplicar ediciones de atrás hacia delante
    edits.sort(key=lambda e: e[0], reverse=True)
    out = src
    for off, old, new in edits:
        if old == '':
            out = out[:off] + new + out[off:]
        else:
            out = out[:off] + new + out[off + len(old):]

    if not dry:
        # verificación de sintaxis tras transformar
        for s, e in split_statements(out):
            if out[s:e].strip():
                try:
                    parse_sql(out[s:e])
                except Exception as ex:
                    line = out[:s].count('\n') + 1
                    raise SystemExit(
                        f'STATEMENT ROTO tras transformar (linea {line}): {ex}\n'
                        f'--- inicio del statement transformado ---\n{out[s:min(e, s+400)]}\n---')
        open(path, 'w', encoding='utf-8').write(out)
    print(f'{path}: {len(edits)} ediciones de idempotencia'
          + (' (dry-run)' if dry else ''))


if __name__ == '__main__':
    paths = sys.argv[1:] or ['setup-camperocasion.sql']
    for p in paths:
        transform(p)
