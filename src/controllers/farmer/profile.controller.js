import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const getProfile = async (req, res) => {
  try {
    const farmer = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        bookings: true
      }
    });

    if (!farmer) {
      return res.status(404).json({ success: false, message: 'Farmer not found' });
    }

    res.json({
      success: true,
      data: {
        name: farmer.name,
        email: farmer.email,
        location: farmer.location || 'Not Specified',
        phone: farmer.phone || '',
        language: farmer.language,
        total_bookings: farmer.bookings.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, location, phone, email } = req.body;
    
    if (!name || !location) {
      return res.status(400).json({ success: false, message: 'Name and location are required' });
    }

    const updatedFarmer = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, location, phone, email }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        name: updatedFarmer.name,
        location: updatedFarmer.location,
        phone: updatedFarmer.phone,
        email: updatedFarmer.email
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both passwords are required' });
    }

    const farmer = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    const isMatch = await bcrypt.compare(oldPassword, farmer.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect old password' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newPasswordHash }
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateLanguage = async (req, res) => {
  try {
    const { language } = req.body;
    
    if (!['en', 'naira', 'yo', 'pcm', 'es'].includes(language)) {
      return res.status(400).json({ success: false, message: 'Invalid language selection' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { language }
    });

    res.json({ success: true, message: 'Language updated successfully', data: { language } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
