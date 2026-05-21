const bcrypt = require('bcryptjs');

const value = String(process.argv[2] || '');

if (!value) {
    console.error('Uso: node scripts/generate-bcrypt-hash.js <valor>');
    process.exit(1);
}

console.log(bcrypt.hashSync(value, 10));
