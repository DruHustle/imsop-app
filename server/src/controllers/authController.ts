import { Request, Response } from 'express';
import { db } from '../config/db';
import { users } from '../models/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  try {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.insert(users).values({
      email,
      password: hashedPassword,
      name,
      role: 'user',
    });

    const newUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    res.status(201).json({ user: { id: newUser?.id, email: newUser?.email, name: newUser?.name, role: newUser?.role } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user' });
  }
};

export const getCurrentUser = async (req: any, res: Response) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requestReset = async (req: Request, res: Response) => {
  const { email } = req.body;
  // Mock implementation for now
  res.json({ success: true, message: 'Reset link sent to email', token: 'mock-reset-token' });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  // Mock implementation for now
  res.json({ success: true, message: 'Password reset successfully' });
};

export const updateProfile = async (req: any, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    await db.update(users).set(updates).where(eq(users.id, id));
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    res.json({ user: { id: updatedUser?.id, email: updatedUser?.email, name: updatedUser?.name, role: updatedUser?.role } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const changePassword = async (req: any, res: Response) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
};
