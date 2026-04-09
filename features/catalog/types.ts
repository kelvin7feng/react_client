export type Brand = {
  id: number;
  name: string;
  pinyin?: string;
  english_name?: string;
  logo_url?: string;
  [key: string]: unknown;
};

export type VehicleBrief = {
  id: number;
  brand_id: number;
  model_name: string;
  reference_min_price: number;
  reference_max_price: number;
  main_image?: string;
  brand_name?: string;
  [key: string]: unknown;
};

export type VehicleColor = {
  id: number;
  vehicle_id: number;
  color_name: string;
  rgb_value?: string;
  [key: string]: unknown;
};

export type VehicleImage = {
  id: number;
  vehicle_id?: number;
  image_url: string;
  image_type?: string;
  image_title?: string;
  [key: string]: unknown;
};

export type VehicleDetail = VehicleBrief & {
  model_year?: number;
  vehicle_type?: string;
  license_type?: string;
  voltage?: number;
  power?: number;
  motor_type?: string;
  motor_brand?: string;
  max_speed?: number;
  climbing_ability?: string;
  battery_type?: string;
  battery_brand?: string;
  battery_capacity?: number;
  theoretical_range?: number;
  actual_range?: number;
  charging_time?: number;
  battery_life?: string;
  removable_battery?: boolean;
  length?: number;
  width?: number;
  height?: number;
  wheelbase?: number;
  seat_height?: number;
  ground_clearance?: number;
  curb_weight?: number;
  front_brake?: string;
  rear_brake?: string;
  brake_system?: string;
  front_suspension?: string;
  rear_suspension?: string;
  front_tire_size?: string;
  rear_tire_size?: string;
  tire_brand?: string;
  tire_type?: string;
  unlock_app?: boolean;
  unlock_bluetooth?: boolean;
  unlock_nfc?: boolean;
  unlock_remote?: boolean;
  unlock_key?: boolean;
  smart_system?: boolean;
  app_name?: string;
  gps_tracking?: boolean;
  remote_control?: boolean;
  anti_theft_system?: boolean;
  display_type?: string;
  headlight_type?: string;
  taillight_type?: string;
  under_seat_storage?: boolean;
  storage_capacity?: number;
  hook?: boolean;
  frame_material?: string;
  waterproof_rating?: string;
  brand_name?: string;
  images?: VehicleImage[];
  colors?: VehicleColor[];
  [key: string]: unknown;
};
