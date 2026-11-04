export interface MapAsset {
  id: string;
  label: string;
  position: { lat: number; lng: number };
  href?: string;
  status?: string;
  observedAt?: string | null;
  route?: string;
}
