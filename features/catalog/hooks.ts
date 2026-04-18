import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/query/keys';

import { fetchBrands, fetchVehicleDetail, fetchVehiclesByBrand, fetchVehiclesByPrice } from './api';
import type { Brand, VehicleBrief, VehicleDetail } from './types';

export function useCatalogBrands() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.brands(),
    queryFn: fetchBrands,
    staleTime: 10 * 60 * 1000,
  });

  return {
    brands: data || ([] as Brand[]),
    loading: isLoading,
    error: error?.message ?? null,
  };
}

export function useVehiclesByBrand(brandId?: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.vehiclesByBrand(brandId!),
    queryFn: () => fetchVehiclesByBrand(brandId!),
    enabled: !!brandId,
    staleTime: 10 * 60 * 1000,
  });

  return {
    vehicles: data || ([] as VehicleBrief[]),
    loading: isLoading,
    error: error?.message ?? null,
  };
}

export function useVehiclesByPrice(minPrice?: string | null, maxPrice?: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.vehiclesByPrice(minPrice!, maxPrice!),
    queryFn: () => fetchVehiclesByPrice(minPrice!, maxPrice!),
    enabled: !!minPrice && !!maxPrice,
    staleTime: 10 * 60 * 1000,
  });

  return {
    vehicles: data || ([] as VehicleBrief[]),
    loading: isLoading,
    error: error?.message ?? null,
  };
}

export function useVehicleDetail(vehicleId?: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.vehicleDetail(vehicleId!),
    queryFn: () => fetchVehicleDetail(vehicleId!),
    enabled: !!vehicleId,
    staleTime: 10 * 60 * 1000,
  });

  return {
    vehicle: data || null,
    loading: isLoading,
    error: error?.message ?? null,
  };
}
