const mongoose = require("mongoose");

const ROLES = ["admin", "staff", "operations", "finance"];

const schema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    designation: {
      type: String,
    },
    totalSell: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ROLES,
      default: "staff",
      index: true,
    },
    isSuperUser: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

// schema.pre('save', function syncAdminFlag(next) {
// 	if (this.role === 'admin') {
// 		this.isSuperUser = true;
// 	} else if (this.isModified('role')) {
// 		this.isSuperUser = false;
// 	} else if (this.isSuperUser && !this.role) {
// 		this.role = 'admin';
// 	}
// 	next();
// });
schema.pre("save", function syncAdminFlag() {
  if (this.role === "admin") {
    this.isSuperUser = true;
  } else if (this.isModified("role")) {
    this.isSuperUser = false;
  } else if (this.isSuperUser && !this.role) {
    this.role = "admin";
  }
});
const Users = mongoose.model("User", schema);

module.exports = Users;
