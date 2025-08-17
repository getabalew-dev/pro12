/** @format */

const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const {
	validateUserRegistration,
	validateUserLogin,
} = require("../middleware/validation");

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
	return jwt.sign({ id }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRE || "7d",
	});
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post("/register", validateUserRegistration, async (req, res) => {
	try {
		const { name, username, password, department, year, phoneNumber, email } =
			req.body;

		// Check if user exists
		const userExists = await User.findOne({
			$or: [{ username }, ...(email ? [{ email }] : [])],
		});

		if (userExists) {
			return res.status(400).json({
				success: false,
				message: "User already exists with this username or email",
			});
		}

		// Create user
		const user = await User.create({
			name,
			username,
			password,
			department,
			year,
			phoneNumber,
			email: email || undefined, // Only set email if provided
			studentId: username, // Use username as student ID
		});

		// Generate token
		const token = generateToken(user._id);

		res.status(201).json({
			success: true,
			message: "User registered successfully",
			token,
			user: {
				id: user._id,
				name: user.name,
				username: user.username,
				email: user.email,
				department: user.department,
				year: user.year,
				role: user.role,
				isAdmin: user.isAdmin,
				profileImage: user.profileImage,
			},
		});
	} catch (error) {
		console.error("Registration error:", error);
		if (error.name === "ValidationError") {
			const errors = Object.values(error.errors).map((err) => err.message);
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors,
			});
		}
		res.status(500).json({
			success: false,
			message: "Server error during registration",
		});
	}
});

// @desc    Login user (Student)
// @route   POST /api/auth/login
// @access  Public
router.post("/login", validateUserLogin, async (req, res) => {
	try {
		const { username, password } = req.body;

		// Check for user and include password
		const user = await User.findOne({ username }).select("+password");
		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		// Check if account is locked or inactive
		if (user.isLocked) {
			return res.status(423).json({
				success: false,
				message:
					"Account temporarily locked due to too many failed login attempts",
			});
		}

		if (!user.isActive) {
			return res.status(401).json({
				success: false,
				message: "Account has been deactivated",
			});
		}

		// Check password
		const isMatch = await user.matchPassword(password);
		if (!isMatch) {
			await user.incLoginAttempts(); // Increment login attempts
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		// Update last login
		await user.updateLastLogin();

		// Generate token
		const token = generateToken(user._id);

		res.json({
			success: true,
			message: "Login successful",
			token,
			user: {
				id: user._id,
				name: user.name,
				username: user.username,
				email: user.email,
				department: user.department,
				year: user.year,
				role: user.role,
				isAdmin: user.isAdmin,
				profileImage: user.profileImage,
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({
			success: false,
			message: "Server error during login",
		});
	}
});

// @desc    Admin Login
// @route   POST /api/auth/admin-login
// @access  Public
router.post("/admin-login", async (req, res) => {
	try {
		const { email, password } = req.body;
		console.log("Admin login attempt:", { email, password });

		// Check for admin user by email
		const user = await User.findOne({ email, isAdmin: true }).select(
			"+password"
		);
		console.log("Found user:", user);

		if (!user) {
			console.error("No admin user found with this email");
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		// Check password
		const isMatch = await user.matchPassword(password);
		console.log("Password match result:", isMatch);
		if (!isMatch) {
			console.error("Password does not match for user:", user.username);
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		// Generate token
		const token = generateToken(user._id);
		res.json({
			success: true,
			message: "Admin login successful",
			token,
			user: {
				id: user._id,
				name: user.name,
				username: user.username,
				email: user.email,
				role: user.role,
				isAdmin: user.isAdmin,
				profileImage: user.profileImage,
			},
		});
	} catch (error) {
		console.error("Admin login error:", error);
		res.status(500).json({
			success: false,
			message: "Server error during admin login",
		});
	}
});

// @desc    Admin Registration
// @route   POST /api/auth/admin-register
// @access  Public
router.post("/admin-register", validateUserRegistration, async (req, res) => {
	try {
		const { name, username, password, email } = req.body;

		// Check if admin user exists
		const userExists = await User.findOne({
			$or: [{ username }, { email }],
		});

		if (userExists) {
			return res.status(400).json({
				success: false,
				message: "Admin username or email already exists",
			});
		}

		// Create admin user
		const admin = await User.create({
			name,
			username,
			password,
			email,
			role: "admin", // Ensure proper role assignment
			isAdmin: true,
		});

		// Generate token and respond
		const token = generateToken(admin._id);
		res.status(201).json({
			success: true,
			message: "Admin registered successfully",
			token,
			user: admin,
		});
	} catch (error) {
		console.error("Admin registration error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
});

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
router.get("/profile", protect, async (req, res) => {
	try {
		const user = await User.findById(req.user.id)
			.populate("joinedClubs", "name category")
			.select("-password");

		res.json({
			success: true,
			user,
		});
	} catch (error) {
		console.error("Profile fetch error:", error);
		res.status(500).json({
			success: false,
			message: "Server error fetching profile",
		});
	}
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put("/profile", protect, async (req, res) => {
	try {
		const { name, department, year, phoneNumber, address, email } = req.body;

		const user = await User.findById(req.user.id);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		// Update fields
		if (name) user.name = name;
		if (department) user.department = department;
		if (year) user.year = year;
		if (phoneNumber) user.phoneNumber = phoneNumber;
		if (address) user.address = address;
		if (email) user.email = email;

		await user.save();

		res.json({
			success: true,
			message: "Profile updated successfully",
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				username: user.username,
				department: user.department,
				year: user.year,
				phoneNumber: user.phoneNumber,
				address: user.address,
				role: user.role,
				isAdmin: user.isAdmin,
				profileImage: user.profileImage,
			},
		});
	} catch (error) {
		console.error("Profile update error:", error);
		res.status(500).json({
			success: false,
			message: "Server error updating profile",
		});
	}
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put("/change-password", protect, async (req, res) => {
	try {
		const { currentPassword, newPassword } = req.body;

		if (!currentPassword || !newPassword) {
			return res.status(400).json({
				success: false,
				message: "Please provide current and new password",
			});
		}

		if (newPassword.length < 8) {
			return res.status(400).json({
				success: false,
				message: "New password must be at least 8 characters",
			});
		}

		const user = await User.findById(req.user.id).select("+password");

		// Check current password
		const isMatch = await user.matchPassword(currentPassword);
		if (!isMatch) {
			return res.status(400).json({
				success: false,
				message: "Current password is incorrect",
			});
		}

		// Update password
		user.password = newPassword;
		await user.save();

		res.json({
			success: true,
			message: "Password changed successfully",
		});
	} catch (error) {
		console.error("Password change error:", error);
		res.status(500).json({
			success: false,
			message: "Server error changing password",
		});
	}
});

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
router.post("/logout", protect, (req, res) => {
	res.json({
		success: true,
		message: "Logged out successfully",
	});
});

module.exports = router;
