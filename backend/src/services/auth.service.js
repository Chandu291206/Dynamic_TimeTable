const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const { verifyPassword } = require('../utils/password');

function safeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    classId: user.classId,
  };
}

function createToken(user) {
  return jwt.sign({ role: user.role, classId: user.classId }, jwtSecret, {
    subject: String(user.id),
    expiresIn: jwtExpiresIn,
  });
}

async function login(username, password) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) return null;
  return { token: createToken(user), user: safeUser(user) };
}

async function getActiveUser(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  return user && user.isActive ? safeUser(user) : null;
}

module.exports = { login, getActiveUser, safeUser };
