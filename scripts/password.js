/**
 * Cryptographic Password Generator
 * Generates secure, high-entropy passwords using standard Web Crypto API.
 */

const CHARSETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

/**
 * Generate a random integer between 0 and max (exclusive) with uniform distribution.
 * Avoids modulo bias.
 */
function getRandomInt(max) {
  if (max <= 1) return 0;
  const cryptoObj = globalThis.crypto;
  const maxUint32 = 0xFFFFFFFF;
  const limit = maxUint32 - (maxUint32 % max);
  const buffer = new Uint32Array(1);

  let randomVal;
  do {
    cryptoObj.getRandomValues(buffer);
    randomVal = buffer[0];
  } while (randomVal >= limit);

  return randomVal % max;
}

/**
 * Generate a secure password.
 * @param {number} [length=16] Length of password (min: 4)
 * @param {Object} [options] Charset inclusions
 * @param {boolean} [options.lowercase=true]
 * @param {boolean} [options.uppercase=true]
 * @param {boolean} [options.numbers=true]
 * @param {boolean} [options.symbols=true]
 * @returns {string} The generated password
 */
export function generatePassword(length = 16, options = {}) {
  const {
    lowercase = true,
    uppercase = true,
    numbers = true,
    symbols = true
  } = options;

  let validChars = '';
  const guaranteedChars = [];

  if (lowercase) {
    validChars += CHARSETS.lowercase;
    guaranteedChars.push(CHARSETS.lowercase[getRandomInt(CHARSETS.lowercase.length)]);
  }
  if (uppercase) {
    validChars += CHARSETS.uppercase;
    guaranteedChars.push(CHARSETS.uppercase[getRandomInt(CHARSETS.uppercase.length)]);
  }
  if (numbers) {
    validChars += CHARSETS.numbers;
    guaranteedChars.push(CHARSETS.numbers[getRandomInt(CHARSETS.numbers.length)]);
  }
  if (symbols) {
    validChars += CHARSETS.symbols;
    guaranteedChars.push(CHARSETS.symbols[getRandomInt(CHARSETS.symbols.length)]);
  }

  if (validChars.length === 0) {
    validChars = CHARSETS.lowercase + CHARSETS.uppercase + CHARSETS.numbers;
  }

  const passwordChars = [...guaranteedChars];
  while (passwordChars.length < length) {
    const randomIndex = getRandomInt(validChars.length);
    passwordChars.push(validChars[randomIndex]);
  }

  // Cryptographic Fisher-Yates shuffle
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join('').slice(0, length);
}
