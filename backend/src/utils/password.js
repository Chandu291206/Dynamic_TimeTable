const bcrypt = require('bcrypt');

function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = { hashPassword, verifyPassword };
