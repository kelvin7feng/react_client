import { useEffect, useState } from 'react';

import { fetchBrands, fetchVehicleDetail, fetchVehiclesByBrand, fetchVehiclesByPrice } from './api';
import type { Brand, VehicleBrief, VehicleDetail } from './types';

export function useCatalogBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    fetchBrands()
      .then((data) => {
        if (!cancelled) {
          setBrands(data || []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '获取品牌数据失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { brands, loading, error };
}

export function useVehiclesByBrand(brandId?: string | null) {
  const [vehicles, setVehicles] = useState<VehicleBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!brandId) {
      setVehicles([]);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    fetchVehiclesByBrand(brandId)
      .then((data) => {
        if (!cancelled) {
          setVehicles(data || []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '获取车型数据失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [brandId]);

  return { vehicles, loading, error };
}

export function useVehiclesByPrice(minPrice?: string | null, maxPrice?: string | null) {
  const [vehicles, setVehicles] = useState<VehicleBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!minPrice || !maxPrice) {
      setVehicles([]);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    fetchVehiclesByPrice(minPrice, maxPrice)
      .then((data) => {
        if (!cancelled) {
          setVehicles(data || []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '获取车型数据失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [minPrice, maxPrice]);

  return { vehicles, loading, error };
}

export function useVehicleDetail(vehicleId?: string | null) {
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!vehicleId) {
      setVehicle(null);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    fetchVehicleDetail(vehicleId)
      .then((data) => {
        if (!cancelled) {
          setVehicle(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '获取车辆详情失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  return { vehicle, loading, error };
}
