import { Vehicle } from '../types/fleet';

export interface PublicVehicleOption {
  id: string;
  bks: string;
  label: string;
}

export const FLEET_2T_PLATES: string[] = [
  '29KT01759',
  '29KT01765',
  '29KT01758',
  '29KT01730',
  '29KT01732',
  '29KT11096',
  '50H82360',
  '50H09223',
  '50H36098',
  '50H36358',
  '50H36369',
  '50H36478',
  '50H36676',
  '50H39071',
  '50H39127',
  '50H39346',
  '50H39369',
  '50H39374',
  '50H39620',
  '50H39687',
  '50H39820',
  '29KT20025',
  '50H22604',
  '51D19325',
  '29KT11028',
  '29KT11040',
  '29KT11041',
  '29KT11044',
  '29KT11075',
  '29KT11091',
  '29KT11142',
  '29KT11143',
  '29KT11153',
  '29KT11253',
  '29KT11061',
  '29KT11206',
  '50H48889',
  '29H96398',
  '29H96399',
  '29E15425',
  '29E15416',
  '29E15405',
  '29H96685',
  '29H96624',
  '50H19874',
  '50H26698',
  '50H81424',
  '29KT01703',
  '29KT01705',
  '50H19772',
];

export const DEFAULT_PUBLIC_VEHICLES: PublicVehicleOption[] = FLEET_2T_PLATES.map((bks) => ({
  id: `veh-${bks}`,
  bks,
  label: '2T',
}));

export function createDefaultVehicles(nowIso = new Date().toISOString()): Vehicle[] {
  return FLEET_2T_PLATES.map((bks) => ({
    id: `veh-${bks}`,
    bks,
    label: '2T',
    coldHourDailyQuota: 12,
    active: true,
    createdAt: nowIso,
  }));
}
