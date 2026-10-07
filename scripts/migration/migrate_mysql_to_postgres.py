#!/usr/bin/env python3
"""Copy compatible rows from a restored Laravel MySQL database into empty PostgreSQL.

The default mode is read-only preflight. To write, pass --apply and set
MIGRATION_CONFIRM=copy-mysql-to-empty-postgres. The target must be empty.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import mysql.connector
import psycopg
from psycopg import sql
from psycopg.types.json import Json, Jsonb


TARGET_SCHEMA = "public"
CONFIRMATION = "copy-mysql-to-empty-postgres"
CHUNK_SIZE = 1000


class MigrationError(RuntimeError):
    pass


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise MigrationError(f"Required environment variable is not set: {name}")
    return value


def mysql_connection():
    options: dict[str, Any] = {
        "host": required_env("SOURCE_MYSQL_HOST"),
        "port": int(os.environ.get("SOURCE_MYSQL_PORT", "3306")),
        "user": required_env("SOURCE_MYSQL_USER"),
        "password": os.environ.get("SOURCE_MYSQL_PASSWORD", ""),
        "database": required_env("SOURCE_MYSQL_DATABASE"),
        "charset": "utf8mb4",
        "use_unicode": True,
        "connection_timeout": 15,
    }
    ssl_ca = os.environ.get("SOURCE_MYSQL_SSL_CA", "").strip()
    if ssl_ca:
        options["ssl_ca"] = ssl_ca
    return mysql.connector.connect(**options)


def source_tables(connection) -> set[str]:
    cursor = connection.cursor()
    cursor.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = %s AND table_type = 'BASE TABLE'",
        (required_env("SOURCE_MYSQL_DATABASE"),),
    )
    result = {row[0] for row in cursor.fetchall()}
    cursor.close()
    return result


def source_columns(connection, table_name: str) -> dict[str, dict[str, Any]]:
    cursor = connection.cursor(dictionary=True)
    cursor.execute(
        "SELECT column_name, data_type, is_nullable, column_default, extra "
        "FROM information_schema.columns WHERE table_schema = %s AND table_name = %s "
        "ORDER BY ordinal_position",
        (required_env("SOURCE_MYSQL_DATABASE"), table_name),
    )
    result = {row["column_name"]: row for row in cursor.fetchall()}
    cursor.close()
    return result


def target_tables(connection) -> set[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = %s AND table_type = 'BASE TABLE'",
            (TARGET_SCHEMA,),
        )
        return {row[0] for row in cursor.fetchall()}


def target_columns(connection, table_name: str) -> dict[str, dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT column_name, data_type, is_nullable, column_default, is_identity "
            "FROM information_schema.columns WHERE table_schema = %s AND table_name = %s "
            "ORDER BY ordinal_position",
            (TARGET_SCHEMA, table_name),
        )
        return {
            row[0]: {
                "data_type": row[1],
                "is_nullable": row[2],
                "column_default": row[3],
                "is_identity": row[4],
            }
            for row in cursor.fetchall()
        }


def foreign_keys(connection) -> list[tuple[str, str, str]]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT table_class.relname, constraint_row.conname, "
            "pg_get_constraintdef(constraint_row.oid) "
            "FROM pg_constraint AS constraint_row "
            "JOIN pg_class AS table_class ON table_class.oid = constraint_row.conrelid "
            "JOIN pg_namespace AS schema_row ON schema_row.oid = table_class.relnamespace "
            "WHERE constraint_row.contype = 'f' AND schema_row.nspname = %s "
            "ORDER BY table_class.relname, constraint_row.conname",
            (TARGET_SCHEMA,),
        )
        return list(cursor.fetchall())


def row_count_mysql(connection, table_name: str) -> int:
    # Names originate from information_schema and are escaped as identifiers.
    safe_name = table_name.replace("`", "``")
    cursor = connection.cursor()
    cursor.execute(f"SELECT COUNT(*) FROM `{safe_name}`")
    count = int(cursor.fetchone()[0])
    cursor.close()
    return count


def row_count_postgres(connection, table_name: str) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            sql.SQL("SELECT COUNT(*) FROM {}.{}").format(
                sql.Identifier(TARGET_SCHEMA), sql.Identifier(table_name)
            )
        )
        return int(cursor.fetchone()[0])


def missing_required_columns(
    source: dict[str, dict[str, Any]], target: dict[str, dict[str, Any]]
) -> list[str]:
    missing = []
    for name, column in target.items():
        if name in source:
            continue
        generated = column["is_identity"] == "YES" or bool(
            column["column_default"]
            and "nextval(" in str(column["column_default"]).lower()
        )
        if column["is_nullable"] == "NO" and not column["column_default"] and not generated:
            missing.append(name)
    return missing


def convert_value(value: Any, target_column: dict[str, Any], source_timezone: ZoneInfo) -> Any:
    if value is None:
        return None
    target_type = target_column["data_type"]
    if target_type == "boolean":
        if isinstance(value, (bytes, bytearray)):
            value = int.from_bytes(value, byteorder="big")
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "t", "yes"}
        return bool(value)
    if target_type in {"json", "jsonb"}:
        if isinstance(value, (bytes, bytearray)):
            value = value.decode("utf-8")
        parsed = json.loads(value) if isinstance(value, str) else value
        return Json(parsed) if target_type == "json" else Jsonb(parsed)
    if isinstance(value, datetime):
        if target_type == "timestamp with time zone":
            if value.tzinfo is None:
                value = value.replace(tzinfo=source_timezone)
            return value.astimezone(timezone.utc)
        if target_type == "timestamp without time zone" and value.tzinfo is not None:
            return value.astimezone(source_timezone).replace(tzinfo=None)
    if target_type == "date" and isinstance(value, datetime):
        return value.date()
    if target_type == "bytea" and isinstance(value, bytearray):
        return bytes(value)
    if isinstance(value, Decimal):
        return value
    return value


def sequence_columns(connection, table_name: str, columns: dict[str, dict[str, Any]]) -> list[str]:
    generated = []
    for name, column in columns.items():
        default = str(column["column_default"] or "").lower()
        if column["is_identity"] == "YES" or "nextval(" in default:
            generated.append(name)
    return generated


def reset_sequences(connection, table_name: str, columns: dict[str, dict[str, Any]]) -> None:
    for column_name in sequence_columns(connection, table_name, columns):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT pg_get_serial_sequence(%s, %s)",
                (f"{TARGET_SCHEMA}.{table_name}", column_name),
            )
            sequence_name = cursor.fetchone()[0]
            if not sequence_name:
                continue
            cursor.execute(
                sql.SQL("SELECT MAX({}) FROM {}.{}").format(
                    sql.Identifier(column_name),
                    sql.Identifier(TARGET_SCHEMA),
                    sql.Identifier(table_name),
                )
            )
            maximum = cursor.fetchone()[0]
            if maximum is None or int(maximum) < 1:
                cursor.execute("SELECT setval(%s::regclass, 1, false)", (sequence_name,))
            else:
                cursor.execute("SELECT setval(%s::regclass, %s, true)", (sequence_name, int(maximum)))


def copy_table(
    source_connection,
    target_connection,
    table_name: str,
    source_column_names: list[str],
    target_column_map: dict[str, dict[str, Any]],
    source_timezone: ZoneInfo,
) -> int:
    mysql_names = ", ".join(f"`{name.replace('`', '``')}`" for name in source_column_names)
    source_name = table_name.replace("`", "``")
    source_cursor = source_connection.cursor()
    source_cursor.execute(f"SELECT {mysql_names} FROM `{source_name}`")
    insert = sql.SQL("INSERT INTO {}.{} ({}) VALUES ({})").format(
        sql.Identifier(TARGET_SCHEMA),
        sql.Identifier(table_name),
        sql.SQL(", ").join(sql.Identifier(name) for name in source_column_names),
        sql.SQL(", ").join(sql.Placeholder() for _ in source_column_names),
    )
    copied = 0
    with target_connection.cursor() as target_cursor:
        while True:
            batch = source_cursor.fetchmany(CHUNK_SIZE)
            if not batch:
                break
            values = [
                tuple(
                    convert_value(value, target_column_map[name], source_timezone)
                    for name, value in zip(source_column_names, row, strict=True)
                )
                for row in batch
            ]
            target_cursor.executemany(insert, values)
            copied += len(values)
    source_cursor.close()
    return copied


def hash_summary(source_connection) -> tuple[int, int, int]:
    columns = source_columns(source_connection, "users")
    if "password" not in columns:
        return 0, 0, 0
    cursor = source_connection.cursor()
    cursor.execute("SELECT `password` FROM `users`")
    total = bcrypt = argon = 0
    while True:
        batch = cursor.fetchmany(CHUNK_SIZE)
        if not batch:
            break
        for (value,) in batch:
            total += 1
            if isinstance(value, str) and re.match(r"^\$2[aby]\$\d\d\$", value):
                bcrypt += 1
            elif isinstance(value, str) and value.startswith(("$argon2i$", "$argon2id$")):
                argon += 1
    cursor.close()
    return total, bcrypt, argon


def run(apply: bool) -> int:
    if apply and os.environ.get("MIGRATION_CONFIRM") != CONFIRMATION:
        raise MigrationError(
            f"Set MIGRATION_CONFIRM={CONFIRMATION} before using --apply."
        )
    try:
        source_timezone = ZoneInfo(os.environ.get("SOURCE_TIMEZONE", "Asia/Tehran"))
    except ZoneInfoNotFoundError as error:
        raise MigrationError("SOURCE_TIMEZONE must be a valid IANA time zone.") from error

    source_connection = mysql_connection()
    target_connection = psycopg.connect(required_env("DATABASE_URL"))
    try:
        if not apply:
            target_connection.execute("SET TRANSACTION READ ONLY")
        source_connection.start_transaction(isolation_level="REPEATABLE READ", readonly=True)

        source_names = source_tables(source_connection)
        target_names = target_tables(target_connection)
        source_only = sorted(source_names - target_names)
        target_only = sorted(target_names - source_names)
        if source_only:
            raise MigrationError(
                "Source tables have no same-name PostgreSQL table; add an explicit mapping before copying: "
                + ", ".join(source_only)
            )
        shared = sorted(source_names & target_names)
        if not shared:
            raise MigrationError("No matching source and target tables were found.")

        source_column_map: dict[str, dict[str, dict[str, Any]]] = {}
        target_column_map: dict[str, dict[str, dict[str, Any]]] = {}
        source_counts: dict[str, int] = {}
        table_columns: dict[str, list[str]] = {}
        target_counts: dict[str, int] = {}
        for table_name in shared:
            source_map = source_columns(source_connection, table_name)
            target_map = target_columns(target_connection, table_name)
            missing = missing_required_columns(source_map, target_map)
            if missing:
                raise MigrationError(
                    f"{table_name} is missing required target columns with no defaults: {', '.join(missing)}"
                )
            columns = [name for name in source_map if name in target_map]
            if not columns:
                raise MigrationError(f"No common columns found for table {table_name}.")
            source_column_map[table_name] = source_map
            target_column_map[table_name] = target_map
            table_columns[table_name] = columns
            source_counts[table_name] = row_count_mysql(source_connection, table_name)
            target_counts[table_name] = row_count_postgres(target_connection, table_name)

        nonempty = [name for name, count in target_counts.items() if count]
        if nonempty:
            raise MigrationError(
                "Target contains data in mapped tables; this script never merges or truncates: "
                + ", ".join(nonempty)
            )

        print(f"Mode: {'APPLY' if apply else 'READ-ONLY PREFLIGHT'}")
        print(f"Shared tables: {len(shared)}")
        print("Target-only tables (left unchanged): " + (", ".join(target_only) or "none"))
        print("Source-only tables: none")
        print("Source timezone for naive DATETIME values: " + source_timezone.key)
        for table_name in shared:
            print(f"  {table_name}: {source_counts[table_name]} rows; {len(table_columns[table_name])} common columns")
        users_total, bcrypt_count, argon_count = hash_summary(source_connection)
        print(
            "User password hashes: "
            f"{users_total} total, {bcrypt_count} bcrypt-compatible, {argon_count} Argon2; "
            "hash values are never printed."
        )

        if not apply:
            print("Preflight passed. No target data was changed.")
            target_connection.rollback()
            source_connection.rollback()
            return 0

        saved_foreign_keys = foreign_keys(target_connection)
        with target_connection.cursor() as cursor:
            for table_name, constraint_name, _definition in saved_foreign_keys:
                cursor.execute(
                    sql.SQL("ALTER TABLE {}.{} DROP CONSTRAINT {}").format(
                        sql.Identifier(TARGET_SCHEMA),
                        sql.Identifier(table_name),
                        sql.Identifier(constraint_name),
                    )
                )

        for table_name in shared:
            count = copy_table(
                source_connection,
                target_connection,
                table_name,
                table_columns[table_name],
                target_column_map[table_name],
                source_timezone,
            )
            if count != source_counts[table_name]:
                raise MigrationError(
                    f"Row count changed while copying {table_name}: expected {source_counts[table_name]}, got {count}."
                )
            reset_sequences(target_connection, table_name, target_column_map[table_name])
            print(f"  copied {table_name}: {count} rows")

        with target_connection.cursor() as cursor:
            for table_name, constraint_name, definition in saved_foreign_keys:
                cursor.execute(
                    sql.SQL("ALTER TABLE {}.{} ADD CONSTRAINT {} {}").format(
                        sql.Identifier(TARGET_SCHEMA),
                        sql.Identifier(table_name),
                        sql.Identifier(constraint_name),
                        sql.SQL(definition),
                    )
                )

        target_connection.commit()
        source_connection.rollback()
        print("Copy committed; foreign keys were re-created and validated inside the same transaction.")
        return 0
    except Exception:
        target_connection.rollback()
        source_connection.rollback()
        raise
    finally:
        source_connection.close()
        target_connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="copy into an empty PostgreSQL target; requires MIGRATION_CONFIRM",
    )
    args = parser.parse_args()
    try:
        return run(apply=args.apply)
    except (MigrationError, mysql.connector.Error, psycopg.Error, ValueError) as error:
        print(f"Migration stopped: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
