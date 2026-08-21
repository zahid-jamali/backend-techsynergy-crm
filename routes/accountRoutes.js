const express = require("express");
const accountControllers = require("../controllers/accountControllers.js");
const { verifyJWT, requireAdmin } = require("../lib/middleware.js");
const router = express.Router();

router.post("/create", verifyJWT, accountControllers.createAccount);
router.get("/lookup", verifyJWT, accountControllers.lookupAccounts);
router.get("/my", verifyJWT, accountControllers.getMyAccounts);
router.put("/update/:id", verifyJWT, accountControllers.updateMyAccount);
router.patch("/:id/archive", verifyJWT, accountControllers.archiveAccount);
router.delete("/delete/:id", verifyJWT, accountControllers.deleteMyAccount);

// Admin Routes
router.get("/all", verifyJWT, requireAdmin, accountControllers.getAllAccounts);

module.exports = router;
