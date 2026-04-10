// ============================================================
// DuckDB projection — SQL expressions aligned with schema-adapter
// Use for loading raw uploads in DuckDB without pre-normalizing in Node.
// ============================================================

/**
 * DuckDB column reference for a logical field using the same rules as
 * `mapping[field] || field` in normalizeRecord.
 */
export function rawColumnRef(
    mapping: Record<string, string>,
    field: string,
    tableAlias: string
): string {
    const csvField = mapping[field] || field;
    const ident = `"${String(csvField).replace(/"/g, '""')}"`;
    return `${tableAlias}.${ident}`;
}

/**
 * SELECT list expressions producing the same core scalars as normalizeRecord
 * (account, recipient, amount, step, type, balance fields).
 */
export function normalizedSelectExpressions(
    mapping: Record<string, string>,
    tableAlias: string
): string {
    const c = (f: string) => rawColumnRef(mapping, f, tableAlias);

    const bal = (field: string, logical: string) => {
        const key = mapping[field] || field;
        const ident = `"${String(key).replace(/"/g, '""')}"`;
        return `coalesce(try_cast(${tableAlias}.${ident} AS DOUBLE), 0) AS ${logical}`;
    };

    return [
        `coalesce(cast(${c('account')} AS VARCHAR), '') AS account`,
        `coalesce(cast(${c('recipient')} AS VARCHAR), '') AS recipient`,
        `coalesce(try_cast(${c('amount')} AS DOUBLE), 0) AS amount`,
        `coalesce(try_cast(${c('step')} AS DOUBLE), 0) AS step`,
        `coalesce(cast(${c('type')} AS VARCHAR), '') AS type`,
        bal('oldbalanceOrg', 'oldbalance_org'),
        bal('newbalanceOrig', 'newbalance_orig'),
        bal('oldbalanceDest', 'oldbalance_dest'),
        bal('newbalanceDest', 'newbalance_dest'),
    ].join(',\n  ');
}

/**
 * JSON path literal for a mapped field (DuckDB JSONPath syntax).
 * Uses json_extract_string which strips string quotes and works for both
 * numeric and string JSON values when followed by a CAST.
 */
function jsonPathForMappedField(mapping: Record<string, string>, field: string): string {
    const csvField = mapping[field] || field;
    const escaped = String(csvField)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "''")
        .replace(/"/g, '\\"');
    return `'$."${escaped}"'`;
}

/**
 * SELECT list + normalized `payload` expression for creating ygg_norm from
 * a ygg_raw(payload VARCHAR) table where each row is a JSON-serialized raw record.
 *
 * Semantics match normalizedSelectExpressions exactly so DuckDB and in-memory
 * backends stay aligned.  Used by DuckDbExecutionBackend.prepareRaw().
 */
export function normalizedSelectFromJsonPayload(
    mapping: Record<string, string>
): string {
    const p = (field: string) => jsonPathForMappedField(mapping, field);

    const strCol = (field: string, alias: string) =>
        `coalesce(json_extract_string(ygg_raw.payload, ${p(field)}), '') AS ${alias}`;

    const numCol = (field: string, alias: string) =>
        `coalesce(try_cast(json_extract_string(ygg_raw.payload, ${p(field)}) AS DOUBLE), 0) AS ${alias}`;

    // json_object for windowed violation reconstruction (matches NormalizedRecord shape)
    const payloadJson = [
        `json_object(`,
        `  'account',       coalesce(json_extract_string(ygg_raw.payload, ${p('account')}), ''),`,
        `  'recipient',     coalesce(json_extract_string(ygg_raw.payload, ${p('recipient')}), ''),`,
        `  'amount',        coalesce(try_cast(json_extract_string(ygg_raw.payload, ${p('amount')}) AS DOUBLE), 0),`,
        `  'step',          coalesce(try_cast(json_extract_string(ygg_raw.payload, ${p('step')}) AS DOUBLE), 0),`,
        `  'type',          coalesce(json_extract_string(ygg_raw.payload, ${p('type')}), ''),`,
        `  'oldbalanceOrg', coalesce(try_cast(json_extract_string(ygg_raw.payload, ${p('oldbalanceOrg')}) AS DOUBLE), 0),`,
        `  'newbalanceOrig',coalesce(try_cast(json_extract_string(ygg_raw.payload, ${p('newbalanceOrig')}) AS DOUBLE), 0),`,
        `  'oldbalanceDest',coalesce(try_cast(json_extract_string(ygg_raw.payload, ${p('oldbalanceDest')}) AS DOUBLE), 0),`,
        `  'newbalanceDest',coalesce(try_cast(json_extract_string(ygg_raw.payload, ${p('newbalanceDest')}) AS DOUBLE), 0)`,
        `) AS payload`,
    ].join('\n  ');

    return [
        strCol('account', 'account'),
        strCol('recipient', 'recipient'),
        numCol('amount', 'amount'),
        numCol('step', 'step'),
        strCol('type', 'type'),
        numCol('oldbalanceOrg', 'oldbalance_org'),
        numCol('newbalanceOrig', 'newbalance_orig'),
        numCol('oldbalanceDest', 'oldbalance_dest'),
        numCol('newbalanceDest', 'newbalance_dest'),
        payloadJson,
    ].join(',\n  ');
}
