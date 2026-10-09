export type JwtPayload = {
  user_id: number;
  phone: string;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
};

export type AuthUser = {
  userId: number;
  phone: string;
  role: string;
};

export type ProfilePermission = {
  module: string;
  action: string;
};

export type Profile = {
  phone: string;
  role: string;
  permissions: ProfilePermission[];
  first_name?: string;
  last_name?: string;
  email?: string;
  province?: string;
  city?: string;
  address?: string;
};
