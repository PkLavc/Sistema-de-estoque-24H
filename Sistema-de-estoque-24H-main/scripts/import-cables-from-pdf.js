const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const sqlite3 = require('sqlite3').verbose();

const projectRoot = path.resolve(__dirname, '..');
const pdfPath = process.argv[2] || path.resolve(process.env.USERPROFILE || '', 'Downloads', 'CABOS 24HLOCACOES - Google Planilhas.pdf');
const sqliteDbPath = path.join(projectRoot, 'database.db');
const sqlOutputPath = path.join(projectRoot, 'data', 'import-cables-from-pdf.sql');

function inflateObject(pdfBuffer, objectNumber) {
    const pdfText = pdfBuffer.toString('latin1');
    const objectMatch = pdfText.match(new RegExp(`${objectNumber} 0 obj[\\s\\S]*?stream\\r?\\n([\\s\\S]*?)endstream`));
    if (!objectMatch) throw new Error(`Objeto ${objectNumber} nao encontrado no PDF.`);

    const startOffset = objectMatch.index;
    const streamMarker = pdfText.slice(startOffset).match(/stream\r?\n/)[0];
    const streamStart = startOffset + pdfText.slice(startOffset).indexOf(streamMarker) + streamMarker.length;
    const streamEnd = startOffset + objectMatch[0].lastIndexOf('endstream') - 1;

    return zlib.inflateSync(pdfBuffer.subarray(streamStart, streamEnd)).toString('latin1');
}

function buildCharacterMap(cmapText) {
    const map = new Map();

    for (const block of cmapText.match(/\d+ beginbfchar[\s\S]*?endbfchar/gm) || []) {
        for (const match of block.matchAll(/<([0-9A-F]+)>\s*<([0-9A-F]+)>/g)) {
            map.set(parseInt(match[1], 16), String.fromCodePoint(parseInt(match[2], 16)));
        }
    }

    for (const block of cmapText.match(/\d+ beginbfrange[\s\S]*?endbfrange/gm) || []) {
        for (const line of block.split(/\r?\n/)) {
            const match = line.match(/<([0-9A-F]+)>\s*<([0-9A-F]+)>\s*<([0-9A-F]+)>/);
            if (!match) continue;

            let source = parseInt(match[1], 16);
            const sourceEnd = parseInt(match[2], 16);
            let target = parseInt(match[3], 16);

            while (source <= sourceEnd) {
                map.set(source, String.fromCodePoint(target));
                source += 1;
                target += 1;
            }
        }
    }

    return map;
}

function decodeHexString(hex, charMap) {
    return (hex.match(/.{1,4}/g) || [])
        .map((chunk) => charMap.get(parseInt(chunk, 16)) || '')
        .join('');
}

function normalizeCategory(name, category, previousCategory) {
    const trimmed = String(category || '').trim();
    if (trimmed) return trimmed;
    if (/^REDE\b/i.test(name)) return 'REDE';
    return previousCategory || 'Outros';
}

function normalizeQuantity(quantity) {
    const digits = String(quantity || '').trim();
    if (!digits) return 0;

    const value = Number(digits);
    return Number.isInteger(value) && value >= 0 ? value : 0;
}

function parsePdfRows(pdfBuffer) {
    const charMap = buildCharacterMap(inflateObject(pdfBuffer, 15));
    const items = [];

    [6, 8].forEach((objectNumber) => {
        const streamText = inflateObject(pdfBuffer, objectNumber);
        const blocks = streamText.split('BT').slice(1).map((part) => part.split('ET')[0]);

        blocks.forEach((block) => {
            const tmMatch = block.match(/1 0 0 -1 ([0-9.]+) ([0-9.]+) Tm/);
            if (!tmMatch) return;

            const x = Number(tmMatch[1]);
            const y = Number(tmMatch[2]);
            const text = [...block.matchAll(/<([0-9A-F]+)> Tj/g)]
                .map((match) => decodeHexString(match[1], charMap))
                .join('')
                .trim();

            if (!text || y === 15 || ['CABO', 'QUANTIDADE', 'CATEGORIA'].includes(text)) return;
            items.push({ x, y, text });
        });
    });

    const rows = new Map();
    items.forEach((item) => {
        if (!rows.has(item.y)) rows.set(item.y, { name: '', quantity: '', category: '' });
        const row = rows.get(item.y);
        if (item.x < 300) row.name = item.text;
        else if (item.x < 410) row.quantity = item.text;
        else row.category = item.text;
    });

    let previousCategory = 'Outros';
    return [...rows.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, row]) => {
            const name = String(row.name || '').trim();
            if (!name) return null;

            const category = normalizeCategory(name, row.category, previousCategory);
            previousCategory = category;

            return {
                name,
                quantity: normalizeQuantity(row.quantity),
                category
            };
        })
        .filter(Boolean);
}

function openDatabase(databasePath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(databasePath, (error) => {
            if (error) reject(error);
            else resolve(db);
        });
    });
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(error) {
            if (error) reject(error);
            else resolve(this);
        });
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function escapeSqlString(value) {
    return String(value).replace(/'/g, "''");
}

function buildImportSql(rows) {
    const lines = [
        '-- Importacao de cabos gerada automaticamente a partir do PDF.',
        "UPDATE cables SET category = 'Outros' WHERE category IS NULL OR TRIM(category) = '';",
        ''
    ];

    rows.forEach((row) => {
        lines.push(
            `INSERT INTO cables (name, quantity, available_quantity, category, updated_at) VALUES ('${escapeSqlString(row.name)}', ${row.quantity}, ${row.quantity}, '${escapeSqlString(row.category)}', CURRENT_TIMESTAMP) ` +
            `ON CONFLICT(name) DO UPDATE SET quantity = excluded.quantity, available_quantity = excluded.available_quantity, category = excluded.category, updated_at = CURRENT_TIMESTAMP;`
        );
    });

    return `${lines.join('\n')}\n`;
}

async function importIntoSqlite(rows) {
    const db = await openDatabase(sqliteDbPath);

    try {
        await run(
            db,
            `CREATE TABLE IF NOT EXISTS cables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0,
                available_quantity INTEGER NOT NULL DEFAULT 0,
                category TEXT NOT NULL DEFAULT 'Outros',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        );
        await run(db, "ALTER TABLE cables ADD COLUMN category TEXT NOT NULL DEFAULT 'Outros'").catch(() => {});
        await run(db, "ALTER TABLE cables ADD COLUMN available_quantity INTEGER NOT NULL DEFAULT 0").catch(() => {});
        await run(db, "UPDATE cables SET category = 'Outros' WHERE category IS NULL OR TRIM(category) = ''");
        await run(db, "UPDATE cables SET available_quantity = quantity WHERE available_quantity IS NULL OR available_quantity = 0");

        for (const row of rows) {
            await run(
                db,
                `INSERT INTO cables (name, quantity, available_quantity, category, updated_at)
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(name) DO UPDATE SET
                    quantity = excluded.quantity,
                    available_quantity = excluded.available_quantity,
                    category = excluded.category,
                    updated_at = CURRENT_TIMESTAMP`,
                [row.name, row.quantity, row.quantity, row.category]
            );
        }
    } finally {
        await close(db);
    }
}

async function main() {
    if (!fs.existsSync(pdfPath)) throw new Error(`PDF nao encontrado em ${pdfPath}`);

    const rows = parsePdfRows(fs.readFileSync(pdfPath));
    if (rows.length === 0) throw new Error('Nenhum cabo foi identificado no PDF.');

    fs.mkdirSync(path.dirname(sqlOutputPath), { recursive: true });
    fs.writeFileSync(sqlOutputPath, buildImportSql(rows), 'utf8');
    await importIntoSqlite(rows);

    const categories = [...new Set(rows.map((row) => row.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    console.log(`Cabos importados no SQLite: ${rows.length}`);
    console.log(`Categorias encontradas: ${categories.length}`);
    console.log(`SQL para D1 gerado em: ${sqlOutputPath}`);
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
