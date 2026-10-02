import express from "express";

import { getAllUsers, getMe, getUser, updateProfile } from "../controllers/user.js";

const router = express.Router();

router.get("/", getAllUsers);
router.get("/me", getMe);
router.put("/profile", updateProfile);
router.get("/:userId", getUser);

export default router;
