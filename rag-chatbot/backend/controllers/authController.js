import { getUsersCollection } from "../config/database.js";
import { HttpError, isEmail } from "../utils/helpers.js";
import { verifyLogin, signToken, publicUser, hashPassword } from "../services/userService.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import nodemailer from "nodemailer";

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};
    const user = await verifyLogin(email, password);
    res.json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await getUsersCollection().findOne({ _id: req.user.id });
    res.json({ success: true, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    const users = getUsersCollection();
    const user = await users.findOne({ _id: req.user.id });
    if (!(await bcrypt.compare(String(currentPassword || ""), user.passwordHash))) {
      throw new HttpError(400, "Current password is incorrect.");
    }
    await users.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(newPassword) } });
    res.json({ success: true, message: "Password updated." });
  } catch (err) {
    next(err);
  }
}

export async function requestPasswordReset(req, res, next) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, FRONTEND_URL } = process.env;
    const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD && SMTP_FROM);
    if (!smtpConfigured && process.env.NODE_ENV === "production") {
      throw new HttpError(503, "Password recovery email is not configured. Contact your administrator.");
    }
    // Keep the response identical for unknown addresses to avoid account discovery.
    if (!isEmail(email)) return res.json({ success: true, message: "If an active account exists for that email, a reset link will be sent." });
    const users = getUsersCollection();
    const user = await users.findOne({ email, active: true });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await users.updateOne({ _id: user._id }, { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expires } });
      const resetUrl = `${(FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "")}/reset-password?token=${token}`;
      if (!smtpConfigured) {
        // Local development fallback: expose the one-time link only in the backend terminal.
        console.info(`🔑 Development password reset link for ${user.email}: ${resetUrl}`);
      } else {
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT || 587),
          secure: Number(SMTP_PORT || 587) === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
        });
        try {
          await transporter.sendMail({
            from: SMTP_FROM,
            to: user.email,
            subject: "Reset your Academic Chat password",
            text: `Hello ${user.name},\n\nUse this link to reset your password within one hour:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
          });
        } catch (mailError) {
          console.error("Password recovery email could not be sent:", mailError.message);
          await users.updateOne({ _id: user._id }, { $unset: { passwordResetTokenHash: "", passwordResetExpiresAt: "" } });
        }
      }
    }
    res.json({ success: true, message: "If an active account exists for that email, a reset link will be sent." });
  } catch (err) { next(err); }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body ?? {};
    if (typeof token !== "string" || token.length !== 64) throw new HttpError(400, "This password reset link is invalid or has expired.");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const users = getUsersCollection();
    const user = await users.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() }, active: true });
    if (!user) throw new HttpError(400, "This password reset link is invalid or has expired.");
    await users.updateOne({ _id: user._id }, {
      $set: { passwordHash: await hashPassword(newPassword) },
      $unset: { passwordResetTokenHash: "", passwordResetExpiresAt: "" },
    });
    res.json({ success: true, message: "Password updated. You can now sign in." });
  } catch (err) { next(err); }
}
