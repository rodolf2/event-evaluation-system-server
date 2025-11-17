const User = require('../../models/User');

// Bootstrap first admin user
const bootstrapAdmin = async (req, res) => {
  try {
    // Check if any admin users already exist
    const existingAdmins = await User.find({
      $or: [
        { role: 'admin' },
        { email: { $regex: '@laverdad.edu.ph$' } }
      ]
    });

    if (existingAdmins.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Admin users already exist. Bootstrap not allowed.'
      });
    }

    // Create first admin user
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    // Check if email domain is valid for admin (development mode allows testing)
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isProduction && !email.endsWith('@laverdad.edu.ph')) {
      return res.status(400).json({
        success: false,
        message: 'Only @laverdad.edu.ph email addresses are allowed for administrators.'
      });
    }

    if (isDevelopment && !email.endsWith('@laverdad.edu.ph') && !email.includes('admin')) {
      return res.status(400).json({
        success: false,
        message: 'In development mode, email must end with @laverdad.edu.ph or contain "admin". Current NODE_ENV: ' + process.env.NODE_ENV
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Promote existing user to admin
      existingUser.role = 'admin';
      await existingUser.save();

      return res.json({
        success: true,
        message: 'Existing user promoted to admin successfully',
        data: {
          user: {
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            role: existingUser.role
          }
        }
      });
    }

    // Create new admin user
    const newAdmin = new User({
      name,
      email,
      role: 'admin',
      isActive: true
    });

    try {
      const savedAdmin = await newAdmin.save();
      res.status(201).json({
        success: true,
        message: 'First admin user created successfully',
        data: {
          user: {
            id: savedAdmin._id,
            name: savedAdmin.name,
            email: savedAdmin.email,
            role: savedAdmin.role
          }
        }
      });
    } catch (saveError) {
      // Handle duplicate key error for googleId
      if (saveError.code === 11000 && saveError.keyPattern?.googleId) {
        console.log('🔄 Duplicate googleId error - trying with unique ID...');

        // Generate a unique googleId for admin users
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        newAdmin.googleId = `admin_${timestamp}_${randomSuffix}`;

        try {
          const savedAdmin = await newAdmin.save();
          console.log('✅ Admin user saved with generated googleId');
          res.status(201).json({
            success: true,
            message: 'First admin user created successfully',
            data: {
              user: {
                id: savedAdmin._id,
                name: savedAdmin.name,
                email: savedAdmin.email,
                role: savedAdmin.role
              }
            }
          });
        } catch (retryError) {
          console.error('❌ Admin user retry also failed:', retryError);
          throw saveError;
        }
      } else {
        // If it's not a googleId duplicate error, throw the original error
        throw saveError;
      }
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during bootstrap',
      error: error.message
    });
  }
};

// Check if bootstrap is needed
const checkBootstrapStatus = async (req, res) => {
  try {
    const adminCount = await User.countDocuments({
      $or: [
        { role: 'admin' },
        { email: { $regex: '@laverdad.edu.ph$' } }
      ]
    });

    res.json({
      success: true,
      data: {
        needsBootstrap: adminCount === 0,
        adminCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking bootstrap status',
      error: error.message
    });
  }
};

module.exports = {
  bootstrapAdmin,
  checkBootstrapStatus
};