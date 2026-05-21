const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDbPath = path.join(projectRoot, 'database.db');
const backupDir = path.join(projectRoot, 'backups', 'sqlite');
const reason = String(process.argv[2] || 'manual').trim() || 'manual';

function timestampForFile(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

async function main() {
    if (!fs.existsSync(sourceDbPath)) {
        throw new Error(`Banco SQLite nao encontrado em ${sourceDbPath}`);
    }

    await fs.promises.mkdir(backupDir, { recursive: true });
    const backupName = `database-${timestampForFile()}-${reason.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)}.db`;
    const backupPath = path.join(backupDir, backupName);

    await fs.promises.copyFile(sourceDbPath, backupPath);
    console.log(`Backup SQLite criado em ${backupPath}`);
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
