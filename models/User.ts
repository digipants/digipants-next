import mongoose, { Schema, Model } from "mongoose";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  pincode?: string;
  password?: string;
  image?: string | null;
  provider: "credentials" | "google";
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },

    phone: String,

    address: String,

    pincode: String,

    // ✅ FIXED: typed function + boolean return
    password: {
      type: String,
      required: function (this: IUser): boolean {
        return this.provider === "credentials";
      },
    },

    image: String,

    provider: {
      type: String,
      enum: ["credentials", "google"],
      default: "credentials",
    },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
