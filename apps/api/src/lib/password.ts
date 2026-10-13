import bcrypt from 'bcryptjs'

export function hashPassword(password: string, rounds: number): Promise<string> {
  return bcrypt.hash(password, rounds)
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash)
}
