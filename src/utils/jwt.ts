import jwt from "jsonwebtoken";

export const signToken = (payload: object) => {
  const secret = process.env.JWT_SECRET!;
  const expiresIn: jwt.SignOptions["expiresIn"] =
    (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) || "7d";
  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token: string) => {
  const secret = process.env.JWT_SECRET!;
  return jwt.verify(token, secret);
};
