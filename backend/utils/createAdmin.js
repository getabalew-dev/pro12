const User = require("../models/User");

const createDefaultAdmin = async () => {
	try {
		// Check if any admin already exists
		const adminExists = await User.findOne({
			$or: [
				{ username: "admindbu12" },
				{ email: "admin@dbu.edu.et" }
			]
		});

		if (!adminExists) {
			const admin = await User.create({
				name: "System Administrator",
				username: "admindbu12",
				email: "admin@dbu.edu.et",
				password: "Admin123#",
				role: "admin",
				isAdmin: true,
				department: "Administration",
				year: "1st Year",
			});

			console.log("✅ Default admin user created:", admin.username);
		} else {
			console.log("ℹ️ Admin user already exists");
		}

		// Create sample students for testing (only if they don't exist)
		const sampleStudents = [
			{
				name: "John Doe",
				username: "dbu10304058",
				email: "john.doe@dbu.edu.et",
				password: "Student123#",
				role: "student",
				isAdmin: false,
				department: "Computer Science",
				year: "4th Year",
			},
			{
				name: "Jane Smith",
				username: "dbu10304059",
				email: "jane.smith@dbu.edu.et",
				password: "Student123#",
				role: "student",
				isAdmin: false,
				department: "Engineering",
				year: "3rd Year",
			},
		];

		for (const studentData of sampleStudents) {
			const existingStudent = await User.findOne({
				$or: [
					{ username: studentData.username },
					{ email: studentData.email }
				]
			});
			
			if (!existingStudent) {
				const student = await User.create(studentData);
				console.log(`✅ Sample student created: ${studentData.username}`);
			} else {
				console.log(`ℹ️ Student already exists: ${studentData.username}`);
			}
		}
	} catch (error) {
		console.error("❌ Error creating default users:", error.message);
	}
};

module.exports = { createDefaultAdmin };