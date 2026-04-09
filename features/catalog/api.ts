import { API_ENDPOINTS } from '@/config/api';
import { ApiError, getJson } from '@/shared/http/client';

import type { Brand, VehicleBrief, VehicleDetail } from './types';

async function unwrapData<T>(request: Promise<{ code: number; msg?: string; data: T }>) {
  const response = await request;
  if (response.code !== 0) {
    throw new ApiError(response.msg || '请求失败', 200, response.code, response);
  }
  return response.data;
}

export function fetchBrands() {
  return unwrapData<Brand[]>(getJson(API_ENDPOINTS.GET_BRANDS));
}

export function fetchVehiclesByBrand(brandId: string | number) {
  return unwrapData<VehicleBrief[]>(
    getJson(API_ENDPOINTS.GET_VEHICLES, { brand_id: brandId })
  );
}

export function fetchVehiclesByPrice(minPrice: string | number, maxPrice: string | number) {
  return unwrapData<VehicleBrief[]>(
    getJson(API_ENDPOINTS.GET_VEHICLES_BY_PRICE, {
      min_price: minPrice,
      max_price: maxPrice,
    })
  );
}

export function fetchVehicleDetail(vehicleId: string | number) {
  return unwrapData<VehicleDetail>(
    getJson(API_ENDPOINTS.GET_VEHICLE_DETAIL, { vehicle_id: vehicleId })
  );
}
