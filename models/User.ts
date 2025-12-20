import mongoose, { Schema, Model } from "mongoose";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  image?: string | null;

  provider: "credentials" | "google";

  // 🏆 Lifetime access flag
  subscription: "free" | "premium";

  // 🔐 reset password fields
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },

    password: {
      type: String,
      required: function (this: any) {
        return this.provider === "credentials";
      },
    },

    image: { type: String, default: null },

    provider: {
      type: String,
      enum: ["credentials", "google"],
      default: "credentials",
    },

    // ✅ Lifetime subscription
    subscription: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
    },

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
