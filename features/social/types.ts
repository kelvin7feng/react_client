export type SocialUser = {
  id: number;
  username: string;
  avatar: string;
  signature: string;
  is_followed: boolean;
};

export type ToggleFollowResult = {
  followed: boolean;
};

export type FollowStatusResult = {
  followed: boolean;
};
