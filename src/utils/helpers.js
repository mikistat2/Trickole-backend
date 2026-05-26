const crypto = require('crypto');

function generateInviteCode(length = 8) {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

module.exports = { generateInviteCode };
